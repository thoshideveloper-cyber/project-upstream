"""Saved pool searches — PRIVATE (owner) or FIRM-shared (SOURCING_LAYER_PLAN §3.3)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, SessionDep
from app.models.enums import CompanyType, SavedSearchScope
from app.models.saved_search import SavedSearch
from app.schemas.saved_search import (
    SavedSearchCreate,
    SavedSearchRead,
    SavedSearchUpdate,
)
from app.api.sourcing import _run_pool_search

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


async def _get_owned(search_id: int, db, current_user) -> SavedSearch:
    s = (
        await db.execute(
            select(SavedSearch).where(
                SavedSearch.id == search_id,
                SavedSearch.firm_id == current_user.firm_id,
                SavedSearch.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Saved search not found")
    if s.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your saved search")
    return s


@router.get("")
async def list_saved_searches(db: SessionDep, current_user: CurrentUser):
    """Owned PRIVATE searches + all FIRM-scoped searches in the firm."""
    rows = (
        await db.execute(
            select(SavedSearch)
            .where(
                SavedSearch.firm_id == current_user.firm_id,
                SavedSearch.archived_at.is_(None),
                or_(
                    SavedSearch.scope == SavedSearchScope.FIRM,
                    SavedSearch.owner_id == current_user.id,
                ),
            )
            .order_by(SavedSearch.name)
        )
    ).scalars().all()
    return {
        "items": [SavedSearchRead.model_validate(s).model_dump() for s in rows],
        "total": len(rows),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_saved_search(
    body: SavedSearchCreate, db: SessionDep, current_user: CurrentUser
):
    s = SavedSearch(
        firm_id=current_user.firm_id,
        owner_id=current_user.id,
        name=body.name,
        scope=body.scope,
        criteria=body.criteria,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return SavedSearchRead.model_validate(s).model_dump()


@router.patch("/{search_id}")
async def update_saved_search(
    search_id: int, body: SavedSearchUpdate, db: SessionDep, current_user: CurrentUser
):
    s = await _get_owned(search_id, db, current_user)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    await db.commit()
    await db.refresh(s)
    return SavedSearchRead.model_validate(s).model_dump()


@router.delete("/{search_id}", status_code=status.HTTP_200_OK)
async def archive_saved_search(
    search_id: int, db: SessionDep, current_user: CurrentUser
):
    s = await _get_owned(search_id, db, current_user)
    s.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Saved search archived"}


@router.post("/{search_id}/run")
async def run_saved_search(
    search_id: int,
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int = Query(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
):
    """Shortcut: re-apply a saved search's criteria against the pool for a mandate."""
    s = (
        await db.execute(
            select(SavedSearch).where(
                SavedSearch.id == search_id,
                SavedSearch.firm_id == current_user.firm_id,
                SavedSearch.archived_at.is_(None),
                or_(
                    SavedSearch.scope == SavedSearchScope.FIRM,
                    SavedSearch.owner_id == current_user.id,
                ),
            )
        )
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Saved search not found")

    c = s.criteria or {}
    ctype = None
    if c.get("type"):
        try:
            ctype = CompanyType(c["type"])
        except ValueError:
            ctype = None
    return await _run_pool_search(
        db,
        current_user,
        mandate_id=mandate_id,
        q=c.get("q"),
        hq=c.get("hq"),
        category_id=c.get("category_id"),
        ctype=ctype,
        rev_min=c.get("rev_min"),
        rev_max=c.get("rev_max"),
        headcount_min=c.get("headcount_min"),
        headcount_max=c.get("headcount_max"),
        has_score=bool(c.get("has_score", False)),
        sort=c.get("sort", "name"),
        page=page,
        page_size=page_size,
    )
