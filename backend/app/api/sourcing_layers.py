"""Sourcing layers router — per-engagement ordered *thesis bands* (§7.3).

DEPRECATED (SOURCING_LAYER_PLAN §1.4): the term "sourcing layer" now refers to the
firm-wide funnel (``/sourcing-stages`` + ``/sourcing-candidates``). This per-mandate
thesis-band concept is retained (data not dropped, endpoints keep serving for
back-compat) but removed from the nav/grid and superseded by the funnel. No new callers.

Layers are the analyst's own segmentation, so anyone who can see the engagement may
manage them (rename / reorder / add / archive) — not a partner-only function. Every
route is visibility-scoped through the parent mandate.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.models.mandate import Mandate
from app.models.sourcing_layer import SourcingLayer
from app.schemas.sourcing_layer import (
    SourcingLayerCreate,
    SourcingLayerRead,
    SourcingLayerUpdate,
)

router = APIRouter(
    prefix="/sourcing-layers", tags=["sourcing-layers (deprecated)"], deprecated=True
)


async def _assert_mandate_visible(mandate_id: int, db, current_user) -> Mandate:
    visible = await visible_mandate_ids(current_user, db)
    q = select(Mandate).where(
        Mandate.id == mandate_id,
        Mandate.firm_id == current_user.firm_id,
    )
    if visible is not None:
        q = q.where(Mandate.id.in_(visible))
    mandate = (await db.execute(q)).scalar_one_or_none()
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate


async def _get_layer(layer_id: int, db, current_user) -> SourcingLayer:
    layer = (
        await db.execute(
            select(SourcingLayer).where(
                SourcingLayer.id == layer_id,
                SourcingLayer.firm_id == current_user.firm_id,
            )
        )
    ).scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Sourcing layer not found")
    # Enforce engagement visibility for analysts.
    await _assert_mandate_visible(layer.mandate_id, db, current_user)
    return layer


@router.get("")
async def list_layers(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int = Query(...),
    include_archived: bool = Query(default=False),
):
    """List the ordered sourcing layers for one engagement."""
    await _assert_mandate_visible(mandate_id, db, current_user)
    stmt = select(SourcingLayer).where(
        SourcingLayer.firm_id == current_user.firm_id,
        SourcingLayer.mandate_id == mandate_id,
    )
    if not include_archived:
        stmt = stmt.where(SourcingLayer.archived_at.is_(None))
    stmt = stmt.order_by(SourcingLayer.sort_order, SourcingLayer.id)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [SourcingLayerRead.model_validate(r).model_dump() for r in rows],
        "total": len(rows),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_layer(
    body: SourcingLayerCreate, db: SessionDep, current_user: CurrentUser
):
    await _assert_mandate_visible(body.mandate_id, db, current_user)

    sort_order = body.sort_order
    if sort_order is None:
        # Append: max(sort_order)+10 within the engagement.
        max_order = (
            await db.execute(
                select(func.max(SourcingLayer.sort_order)).where(
                    SourcingLayer.mandate_id == body.mandate_id
                )
            )
        ).scalar()
        sort_order = (max_order or 0) + 10

    layer = SourcingLayer(
        firm_id=current_user.firm_id,
        mandate_id=body.mandate_id,
        name=body.name,
        sort_order=sort_order,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return SourcingLayerRead.model_validate(layer).model_dump()


@router.patch("/{layer_id}")
async def update_layer(
    layer_id: int,
    body: SourcingLayerUpdate,
    db: SessionDep,
    current_user: CurrentUser,
):
    layer = await _get_layer(layer_id, db, current_user)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(layer, field, val)
    await db.commit()
    await db.refresh(layer)
    return SourcingLayerRead.model_validate(layer).model_dump()


@router.delete("/{layer_id}", status_code=status.HTTP_200_OK)
async def archive_layer(layer_id: int, db: SessionDep, current_user: CurrentUser):
    """Soft-delete a layer. Companies pointing at it fall back to the "Unsorted" band."""
    layer = await _get_layer(layer_id, db, current_user)
    layer.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Sourcing layer archived"}
