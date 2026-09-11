"""Pool ingest router — CSV + IB-DB import (SOURCING_LAYER_PLAN §3.2 / §4.3).

4-step wizard: preview → validate (dry-run dedup) → apply (idempotent). Every write is
firm-scoped and gated by the dry-run preview. Re-importing the same file upserts profiles
(via ``upsert_profile``'s domain/name block keys), never duplicates.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from app.core.deps import CurrentUser, PartnerDep, SessionDep
from app.models.enums import ActivityObjectType, ActivityVerb, ImportRowAction, ImportSource, ImportStatus
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.schemas.import_batch import (
    ImportApplyRequest,
    ImportBatchRead,
    ImportRowRead,
    ImportValidateRequest,
)
from app.services import activity
from app.services.imports import (
    PROFILE_FIELDS,
    apply_import,
    decode_bytes,
    dedup_preview,
    parse_csv,
    suggest_mapping,
    template_csv,
)

router = APIRouter(prefix="/imports", tags=["imports"])

_FIELD_META = [{"field": f, "label": label, "required": req} for f, label, req in PROFILE_FIELDS]


async def _get_batch(batch_id: int, firm_id: int, db) -> ImportBatch:
    batch = (
        await db.execute(
            select(ImportBatch).where(
                ImportBatch.id == batch_id, ImportBatch.firm_id == firm_id
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    return batch


async def _batch_rows(batch_id: int, db) -> list[ImportRow]:
    return list(
        (
            await db.execute(
                select(ImportRow)
                .where(ImportRow.batch_id == batch_id)
                .order_by(ImportRow.row_index)
            )
        )
        .scalars()
        .all()
    )


@router.get("/template.csv", response_class=PlainTextResponse)
async def download_template(current_user: CurrentUser):
    return PlainTextResponse(
        template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=upstream_import_template.csv"},
    )


@router.get("")
async def list_batches(db: SessionDep, current_user: CurrentUser):
    rows = (
        await db.execute(
            select(ImportBatch)
            .where(ImportBatch.firm_id == current_user.firm_id)
            .order_by(ImportBatch.created_at.desc())
        )
    ).scalars().all()
    return {
        "items": [ImportBatchRead.model_validate(b).model_dump() for b in rows],
        "total": len(rows),
    }


@router.post("/csv/preview", status_code=status.HTTP_201_CREATED)
async def preview_csv(
    db: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    source: ImportSource = Form(default=ImportSource.CSV),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    text = decode_bytes(raw)
    headers, rows = parse_csv(text)
    if not headers:
        raise HTTPException(status_code=422, detail="No columns detected in file")

    file_hash = hashlib.sha256(raw).hexdigest()
    batch = ImportBatch(
        firm_id=current_user.firm_id,
        uploaded_by=current_user.id,
        source=source,
        filename=file.filename,
        file_hash=file_hash,
        row_count=len(rows),
        status=ImportStatus.PREVIEWED,
    )
    db.add(batch)
    await db.flush()
    for i, raw_row in enumerate(rows):
        db.add(ImportRow(batch_id=batch.id, row_index=i, raw=raw_row))
    await db.commit()
    await db.refresh(batch)

    return {
        "batch_id": batch.id,
        "file_hash": file_hash,
        "headers": headers,
        "sample_rows": rows[:10],
        "row_count": len(rows),
        "suggested_mapping": suggest_mapping(headers),
        "fields": _FIELD_META,
    }


@router.post("/csv/validate")
async def validate_csv(
    body: ImportValidateRequest, db: SessionDep, current_user: CurrentUser
):
    batch = await _get_batch(body.batch_id, current_user.firm_id, db)
    rows = await _batch_rows(batch.id, db)
    raw_rows = [r.raw for r in rows]
    preview = await dedup_preview(db, current_user.firm_id, raw_rows, body.mapping)
    # Persist the chosen mapping so apply can be a thin confirm.
    batch.mapping = body.mapping
    await db.commit()
    return preview


@router.post("/csv/apply")
async def apply_csv(
    body: ImportApplyRequest, db: SessionDep, current_user: CurrentUser
):
    batch = await _get_batch(body.batch_id, current_user.firm_id, db)
    if batch.status == ImportStatus.APPLIED:
        # Idempotent: never re-apply a batch (would double-count outcomes).
        return {
            "batch_id": batch.id,
            "status": batch.status.value,
            "created": batch.created_count,
            "updated": batch.updated_count,
            "skipped": batch.skipped_count,
            "already_applied": True,
        }
    rows = await _batch_rows(batch.id, db)
    batch.mapping = body.mapping
    try:
        result = await apply_import(db, batch=batch, rows=rows, mapping=body.mapping)
    except Exception:
        batch.status = ImportStatus.FAILED
        await db.commit()
        raise
    batch.status = ImportStatus.APPLIED
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.IMPORT_APPLIED,
        object_type=ActivityObjectType.IMPORT_BATCH,
        object_id=batch.id,
        object_label=batch.filename,
        meta={
            "source": batch.source.value,
            "created": result.get("created"),
            "updated": result.get("updated"),
            "skipped": result.get("skipped"),
        },
    )
    await db.commit()
    return {"batch_id": batch.id, "status": batch.status.value, **result}


@router.get("/{batch_id}")
async def get_batch(batch_id: int, db: SessionDep, current_user: CurrentUser):
    batch = await _get_batch(batch_id, current_user.firm_id, db)
    rows = await _batch_rows(batch_id, db)
    result = ImportBatchRead.model_validate(batch).model_dump()
    result["rows"] = [ImportRowRead.model_validate(r).model_dump() for r in rows]
    return result


@router.get("/{batch_id}/errors.csv", response_class=PlainTextResponse)
async def download_error_rows(batch_id: int, db: SessionDep, current_user: CurrentUser):
    import csv as _csv
    import io as _io

    batch = await _get_batch(batch_id, current_user.firm_id, db)
    rows = await _batch_rows(batch.id, db)
    error_rows = [r for r in rows if r.action == ImportRowAction.ERROR]
    buf = _io.StringIO()
    if error_rows:
        fieldnames = list(error_rows[0].raw.keys()) + ["_error"]
        writer = _csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for r in error_rows:
            writer.writerow({**r.raw, "_error": r.message or ""})
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=import_{batch_id}_errors.csv"},
    )


@router.post("/ib-db", status_code=status.HTTP_201_CREATED)
async def import_ib_db(
    db: SessionDep,
    current_user: PartnerDep,
    file: UploadFile = File(...),
):
    """Partner one-shot bulk-load of the firm's proprietary company export — same
    idempotent pipeline, ``source=IB_DB``, entering at the pool (Research/Long-list).
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    text = decode_bytes(raw)
    headers, rows = parse_csv(text)
    if not headers:
        raise HTTPException(status_code=422, detail="No columns detected in file")

    mapping = suggest_mapping(headers)
    batch = ImportBatch(
        firm_id=current_user.firm_id,
        uploaded_by=current_user.id,
        source=ImportSource.IB_DB,
        filename=file.filename,
        file_hash=hashlib.sha256(raw).hexdigest(),
        mapping=mapping,
        row_count=len(rows),
        status=ImportStatus.PREVIEWED,
    )
    db.add(batch)
    await db.flush()
    row_models = []
    for i, raw_row in enumerate(rows):
        rm = ImportRow(batch_id=batch.id, row_index=i, raw=raw_row)
        db.add(rm)
        row_models.append(rm)
    await db.flush()

    preview = await dedup_preview(db, current_user.firm_id, rows, mapping)
    result = await apply_import(db, batch=batch, rows=row_models, mapping=mapping)
    batch.status = ImportStatus.APPLIED
    await db.commit()
    return {
        "batch_id": batch.id,
        "status": batch.status.value,
        "mapping": mapping,
        "preview": preview,
        **result,
    }
