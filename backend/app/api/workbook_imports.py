"""Client-workbook onboarding router — inspect → map → preview → apply (WB-1).

Open to any role, scoped by the same visibility rule as the rest of the app. An analyst
who can open a project and an engagement by hand (``create_project`` / ``create_mandate``
are both ``CurrentUser``) can bring the same book in from the spreadsheet it already
lives in — the import is that act, not a different one. What the role changes is *reach*,
not permission: a plan may only name a project or engagement the user can already see
(``_assert_plan_writable``), so an analyst can never write into a colleague's book, and a
newly created engagement is assigned to its creator so the import is visible to them.

The file is uploaded once, at *inspect*; its bytes are re-parsed on every later step from
the batch's stored rows, so the browser never re-uploads to preview or apply.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.models.enums import ImportSource, ImportStatus, UserRole
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.models.mandate import Mandate
from app.models.project import Project
from app.schemas.import_batch import ImportBatchRead, ImportRowRead
from app.services.workbook_import import (
    FLAG_LABELS,
    WorkbookPlan,
    apply_workbook,
    preview_workbook,
    suggest_plan,
)
from app.services.workbook_parse import (
    CONTACTS,
    LONGLIST,
    MASTER,
    SCHEDULE,
    ParsedWorkbook,
    ScheduleRow,
    SheetShape,
    parse_workbook,
)

router = APIRouter(prefix="/imports/workbook", tags=["imports"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


class WorkbookPlanRequest(BaseModel):
    batch_id: int
    plan: dict


async def _visible_project_ids(current_user, db) -> list[int] | None:
    """Project IDs this user may import into. Partners → None (all).

    Mirrors ``projects._visible_project_ids``: an analyst sees projects holding one of
    their assigned engagements, plus projects they created themselves (so a project
    opened moments ago, still empty, is a legal import target).
    """
    if current_user.role == UserRole.PARTNER:
        return None
    ids: set[int] = set()
    owned = await db.execute(
        select(Project.id).where(
            Project.firm_id == current_user.firm_id,
            Project.created_by_id == current_user.id,
        )
    )
    ids.update(row[0] for row in owned.all())
    visible = await visible_mandate_ids(current_user, db)
    if visible:
        rows = await db.execute(
            select(Mandate.project_id)
            .where(Mandate.id.in_(visible), Mandate.project_id.is_not(None))
            .distinct()
        )
        ids.update(row[0] for row in rows.all())
    return list(ids)


async def _assert_plan_writable(plan: WorkbookPlan, current_user, db) -> None:
    """Refuse a plan that reaches outside what this user can already see.

    The wizard's own target list is scoped, but the plan is posted back as JSON and an
    analyst could name any ID. Partners short-circuit (they see everything); for everyone
    else each *existing* project/engagement in the plan must be in their book. Newly
    created ones are unconstrained — opening a project or an engagement is already a
    ``CurrentUser`` action.
    """
    if current_user.role == UserRole.PARTNER:
        return

    project_ids = await _visible_project_ids(current_user, db)
    if plan.project_id is not None and plan.project_id not in (project_ids or []):
        raise HTTPException(
            status_code=403,
            detail=(
                "That project isn't on your desk — pick one you're assigned to, "
                "or name a new one."
            ),
        )

    allowed = set(await visible_mandate_ids(current_user, db) or [])
    named = {s.mandate_id for s in plan.sheets if s.mandate_id}
    if plan.default_mandate_id:
        named.add(plan.default_mandate_id)
    named.update(m for m in plan.reason_mandates.values() if m)
    outside = named - allowed
    if outside:
        raise HTTPException(
            status_code=403,
            detail=(
                "That engagement isn't on your desk — you can only import into "
                "engagements you're assigned to, or a new one you create here."
            ),
        )


async def _get_batch(batch_id: int, firm_id: int, db, owner_id: int | None = None) -> ImportBatch:
    """Load a staged batch. ``owner_id`` restricts it to its uploader.

    A batch holds the verbatim rows of someone's client workbook, so now that any role can
    stage one, a non-partner sees and applies only their own — otherwise an analyst could
    read a partner's staged book, or apply it on their behalf.
    """
    query = select(ImportBatch).where(
        ImportBatch.id == batch_id,
        ImportBatch.firm_id == firm_id,
        ImportBatch.source == ImportSource.WORKBOOK,
    )
    if owner_id is not None:
        query = query.where(ImportBatch.uploaded_by == owner_id)
    batch = (await db.execute(query)).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Workbook import batch not found")
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


def _rehydrate(batch: ImportBatch, rows: list[ImportRow]) -> ParsedWorkbook:
    """Rebuild the parsed workbook from the persisted rows.

    Preview and apply must see exactly what the partner reviewed, so they replay the
    rows stored at inspect time rather than re-reading a file the browser would have
    to send again (and could have swapped underneath us).
    """
    shapes_raw = (batch.mapping or {}).get("_shapes") or []
    shapes = [
        SheetShape(
            title=s["title"],
            kind=s["kind"],
            header_row=s.get("header_row"),
            headers=s.get("headers") or [],
            field_columns={},
            data_row_count=s.get("data_row_count") or 0,
            client_label=s.get("client_label"),
            exchange_rate=None,
            declared_count=s.get("declared_count"),
            unmapped_headers=s.get("unmapped_headers") or [],
            regarding_values=s.get("regarding_values") or [],
        )
        for s in shapes_raw
    ]
    rows_by_sheet: dict[str, list[dict]] = {}
    schedule_rows: dict[str, list[ScheduleRow]] = {}
    for row in rows:
        sheet = row.sheet_name or ""
        payload = row.raw or {}
        if payload.get("_kind") == SCHEDULE:
            schedule_rows.setdefault(sheet, []).append(_schedule_row_from_raw(payload))
        else:
            rows_by_sheet.setdefault(sheet, []).append(
                {k: v for k, v in payload.items() if k != "_kind"}
            )
    return ParsedWorkbook(
        filename=batch.filename or "workbook.xlsx",
        sheets=shapes,
        rows_by_sheet=rows_by_sheet,
        schedule_rows_by_sheet=schedule_rows,
    )


def _schedule_row_to_raw(sr: ScheduleRow) -> dict:
    return {
        "_kind": SCHEDULE,
        "company_name": sr.company_name,
        "regarding": sr.regarding,
        "initial_date": sr.initial_date.isoformat() if sr.initial_date else None,
        "initial_token": sr.initial_token,
        "status_date": sr.status_date.isoformat() if sr.status_date else None,
        "status_token": sr.status_token,
        "follow_up_dates": [d.isoformat() if d else None for d in sr.follow_up_dates],
        "done_count": sr.done_count,
        "check_previous": sr.check_previous,
    }


def _schedule_row_from_raw(payload: dict) -> ScheduleRow:
    from app.services.workbook_parse import as_date

    return ScheduleRow(
        company_name=payload.get("company_name") or "",
        regarding=payload.get("regarding"),
        initial_date=as_date(payload.get("initial_date")),
        initial_token=payload.get("initial_token"),
        status_date=as_date(payload.get("status_date")),
        status_token=payload.get("status_token"),
        follow_up_dates=[as_date(d) for d in (payload.get("follow_up_dates") or [])],
        done_count=int(payload.get("done_count") or 0),
        check_previous=payload.get("check_previous"),
    )


@router.get("/flags")
async def list_flags(current_user: CurrentUser):
    """The review vocabulary — every decision the importer can flag for an analyst."""
    return {"flags": [{"code": code, "label": label} for code, label in FLAG_LABELS.items()]}


@router.get("/targets")
async def import_targets(db: SessionDep, current_user: CurrentUser):
    """Projects + engagements this user can map sheets onto (wizard steps 1–2).

    Scoped, so an analyst is offered only their own book rather than a firm-wide picker
    whose entries the apply step would then refuse.
    """
    project_filter = await _visible_project_ids(current_user, db)
    project_q = select(Project).where(
        Project.firm_id == current_user.firm_id, Project.archived_at.is_(None)
    )
    if project_filter is not None:
        project_q = project_q.where(Project.id.in_(project_filter or [-1]))
    projects = (await db.execute(project_q.order_by(Project.name))).scalars().all()

    mandate_filter = await visible_mandate_ids(current_user, db)
    mandate_q = select(Mandate).where(
        Mandate.firm_id == current_user.firm_id, Mandate.archived_at.is_(None)
    )
    if mandate_filter is not None:
        mandate_q = mandate_q.where(Mandate.id.in_(mandate_filter or [-1]))
    mandates = (await db.execute(mandate_q.order_by(Mandate.name))).scalars().all()
    return {
        "projects": [
            {"id": p.id, "name": p.name, "client_name": p.client_name} for p in projects
        ],
        "mandates": [
            {
                "id": m.id,
                "project_id": m.project_id,
                "name": m.name,
                "type": m.type.value,
                "exchange_rate": float(m.exchange_rate) if m.exchange_rate is not None else None,
            }
            for m in mandates
        ],
    }


@router.post("/inspect", status_code=status.HTTP_201_CREATED)
async def inspect_upload(
    db: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    source: ImportSource = Form(default=ImportSource.WORKBOOK),  # noqa: ARG001 — shape parity
):
    """Step 1 — read the workbook's shape and persist every parsed row.

    Nothing about the CRM is written here: this is the "what's in this file" step, and
    the rows are staged on ``import_rows`` so the later steps never need the file again.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Workbook is larger than 25 MB")
    try:
        parsed = parse_workbook(raw, file.filename or "workbook.xlsx")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    usable = [s for s in parsed.sheets if s.kind in (MASTER, CONTACTS, LONGLIST)]
    if not usable:
        raise HTTPException(
            status_code=422,
            detail="No master sheet or contact list found — check the column headers",
        )

    batch = ImportBatch(
        firm_id=current_user.firm_id,
        uploaded_by=current_user.id,
        source=ImportSource.WORKBOOK,
        filename=file.filename,
        file_hash=hashlib.sha256(raw).hexdigest(),
        status=ImportStatus.PREVIEWED,
    )
    db.add(batch)
    await db.flush()

    row_index = 0
    for shape in parsed.sheets:
        if shape.kind in (MASTER, CONTACTS, LONGLIST):
            for row in parsed.rows_by_sheet.get(shape.title, []):
                db.add(
                    ImportRow(
                        batch_id=batch.id,
                        row_index=row_index,
                        sheet_name=shape.title,
                        raw=row,
                    )
                )
                row_index += 1
    # Scheduler rows are evidence, not entities: they are staged after the master rows
    # so row_index still lines up 1:1 with what the preview/apply iterate over.
    for shape in parsed.sheets:
        if shape.kind != SCHEDULE:
            continue
        for sr in parsed.schedule_rows_by_sheet.get(shape.title, []):
            db.add(
                ImportRow(
                    batch_id=batch.id,
                    row_index=row_index,
                    sheet_name=shape.title,
                    raw=_schedule_row_to_raw(sr),
                )
            )
            row_index += 1

    batch.row_count = row_index
    batch.mapping = {"_shapes": [s.to_dict() for s in parsed.sheets]}
    await db.commit()
    await db.refresh(batch)

    return {
        "batch_id": batch.id,
        "filename": batch.filename,
        "file_hash": batch.file_hash,
        "sheets": [s.to_dict() for s in parsed.sheets],
        "suggested_plan": suggest_plan(parsed),
        "row_count": batch.row_count,
    }


@router.post("/preview")
async def preview(body: WorkbookPlanRequest, db: SessionDep, current_user: CurrentUser):
    """Step 3 — dry run. Classifies every row against the live DB and writes nothing."""
    # Read the identity up front: a rollback below expires ``current_user``, and a
    # lazy re-fetch of an expired attribute cannot happen mid-handler.
    firm_id, actor_id = current_user.firm_id, current_user.id
    owner_id = None if current_user.role == UserRole.PARTNER else actor_id
    await _assert_plan_writable(WorkbookPlan.from_dict(body.plan), current_user, db)
    batch = await _get_batch(body.batch_id, firm_id, db, owner_id)
    rows = await _batch_rows(batch.id, db)
    parsed = _rehydrate(batch, rows)
    plan = WorkbookPlan.from_dict(body.plan)
    result = await preview_workbook(
        db, firm_id=firm_id, actor_id=actor_id, parsed=parsed, plan=plan
    )
    # A dry run must leave nothing behind — drop anything the read path autoflushed
    # before persisting only the plan itself.
    await db.rollback()
    batch = await _get_batch(body.batch_id, firm_id, db, owner_id)
    batch.mapping = {**(batch.mapping or {}), "plan": plan.to_dict()}
    await db.commit()
    return result


@router.post("/apply")
async def apply(body: WorkbookPlanRequest, db: SessionDep, current_user: CurrentUser):
    """Step 4 — write the graph. Re-applying an applied batch is a no-op."""
    firm_id, actor_id = current_user.firm_id, current_user.id
    owner_id = None if current_user.role == UserRole.PARTNER else actor_id
    await _assert_plan_writable(WorkbookPlan.from_dict(body.plan), current_user, db)
    batch = await _get_batch(body.batch_id, firm_id, db, owner_id)
    if batch.status == ImportStatus.APPLIED:
        return {
            "batch_id": batch.id,
            "status": batch.status.value,
            "already_applied": True,
            "summary": batch.summary,
        }
    rows = await _batch_rows(batch.id, db)
    parsed = _rehydrate(batch, rows)
    plan = WorkbookPlan.from_dict(body.plan)
    await _assert_plan_writable(plan, current_user, db)
    entity_rows = [r for r in rows if (r.raw or {}).get("_kind") != SCHEDULE]
    try:
        summary = await apply_workbook(
            db,
            batch=batch,
            parsed=parsed,
            plan=plan,
            firm_id=firm_id,
            actor_id=actor_id,
            import_rows=entity_rows,
        )
    except ValueError as exc:
        # A bad plan (no project, unknown mandate) leaves the batch untouched — the
        # partner fixes the mapping and re-runs the same batch.
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        await db.rollback()
        batch = await _get_batch(body.batch_id, firm_id, db)
        batch.status = ImportStatus.FAILED
        await db.commit()
        raise
    batch.mapping = {**(batch.mapping or {}), "plan": plan.to_dict()}
    batch.status = ImportStatus.APPLIED
    await db.commit()
    return {"batch_id": batch.id, "status": batch.status.value, "summary": summary}


@router.get("/{batch_id}")
async def get_batch(batch_id: int, db: SessionDep, current_user: CurrentUser):
    """The audit record — batch envelope plus every row's resolved outcome."""
    owner_id = None if current_user.role == UserRole.PARTNER else current_user.id
    batch = await _get_batch(batch_id, current_user.firm_id, db, owner_id)
    rows = await _batch_rows(batch_id, db)
    result = ImportBatchRead.model_validate(batch).model_dump()
    result["project_id"] = batch.project_id
    result["summary"] = batch.summary
    result["rows"] = [
        ImportRowRead.model_validate(r).model_dump()
        for r in rows
        if (r.raw or {}).get("_kind") != SCHEDULE
    ]
    return result
