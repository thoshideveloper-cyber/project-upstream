"""Company categories router — firm-configurable counterparty vocabulary (§7.2).

List is readable by any authenticated firm member (needed to populate the add form
and grid grouping); create/update/archive are PARTNER-only management functions since
firms now self-serve the vocabulary.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import CurrentUser, PartnerDep, SessionDep
from app.models.company_category import CompanyCategoryVocab
from app.schemas.company_category import (
    CompanyCategoryCreate,
    CompanyCategoryRead,
    CompanyCategoryUpdate,
)
from app.services.classification import seed_firm_categories

router = APIRouter(prefix="/company-categories", tags=["company-categories"])

_CODE_RE = re.compile(r"[^A-Z0-9]+")


def _code_from_name(name: str) -> str:
    code = _CODE_RE.sub("_", name.strip().upper()).strip("_")
    return code or "CATEGORY"


async def _get_category(category_id: int, firm_id: int, db) -> CompanyCategoryVocab:
    result = await db.execute(
        select(CompanyCategoryVocab).where(
            CompanyCategoryVocab.id == category_id,
            CompanyCategoryVocab.firm_id == firm_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


@router.get("")
async def list_categories(
    db: SessionDep,
    current_user: CurrentUser,
    include_archived: bool = Query(default=False),
):
    """List the firm's category vocabulary, ordered. Seeds defaults on first read."""
    stmt = select(CompanyCategoryVocab).where(
        CompanyCategoryVocab.firm_id == current_user.firm_id
    )
    if not include_archived:
        stmt = stmt.where(CompanyCategoryVocab.archived_at.is_(None))
    stmt = stmt.order_by(CompanyCategoryVocab.sort_order, CompanyCategoryVocab.name)
    rows = (await db.execute(stmt)).scalars().all()

    # Self-heal: a firm created before A1 (or via a path that skipped seeding) gets
    # its defaults on first access so the vocabulary is never empty.
    if not rows:
        await seed_firm_categories(db, current_user.firm_id)
        await db.commit()
        rows = (await db.execute(stmt)).scalars().all()

    return {
        "items": [CompanyCategoryRead.model_validate(c).model_dump() for c in rows],
        "total": len(rows),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CompanyCategoryCreate, db: SessionDep, current_user: PartnerDep
):
    code = (body.code or _code_from_name(body.name)).strip().upper()
    # Enforce unique (firm, code): revive an archived row rather than duplicating.
    existing = (
        await db.execute(
            select(CompanyCategoryVocab).where(
                CompanyCategoryVocab.firm_id == current_user.firm_id,
                CompanyCategoryVocab.code == code,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.archived_at is not None:
            existing.archived_at = None
            existing.name = body.name
            existing.sort_order = body.sort_order
            await db.commit()
            await db.refresh(existing)
            return CompanyCategoryRead.model_validate(existing).model_dump()
        raise HTTPException(status_code=409, detail="A category with this code already exists")

    cat = CompanyCategoryVocab(
        firm_id=current_user.firm_id,
        name=body.name,
        code=code,
        sort_order=body.sort_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CompanyCategoryRead.model_validate(cat).model_dump()


@router.patch("/{category_id}")
async def update_category(
    category_id: int,
    body: CompanyCategoryUpdate,
    db: SessionDep,
    current_user: PartnerDep,
):
    cat = await _get_category(category_id, current_user.firm_id, db)
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(cat, field, val)
    await db.commit()
    await db.refresh(cat)
    return CompanyCategoryRead.model_validate(cat).model_dump()


@router.delete("/{category_id}", status_code=status.HTTP_200_OK)
async def archive_category(
    category_id: int, db: SessionDep, current_user: PartnerDep
):
    """Soft-delete a category. Companies keep their category_id (history preserved)."""
    cat = await _get_category(category_id, current_user.firm_id, db)
    cat.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Category archived"}
