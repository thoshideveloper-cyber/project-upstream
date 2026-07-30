"""Sourcing funnel stages router — firm-wide, partner-managed (SOURCING_LAYER_PLAN §3.1).

The *new* meaning of "sourcing layer": a firm-wide funnel vocabulary. List is readable
by any firm member (to render the kanban/list + candidate cards); create/update/archive
are PARTNER-only. Stage-behaviour invariants (§2.1) are enforced on every mutation.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import CurrentUser, PartnerDep, SessionDep
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_stage import SourcingStage
from app.schemas.sourcing_stage import (
    SourcingStageCreate,
    SourcingStageRead,
    SourcingStageUpdate,
)
from app.services.sourcing import get_firm_stages, validate_stage_invariants

router = APIRouter(prefix="/sourcing-stages", tags=["sourcing-stages"])


async def _get_stage(stage_id: int, firm_id: int, db) -> SourcingStage:
    stage = (
        await db.execute(
            select(SourcingStage).where(
                SourcingStage.id == stage_id, SourcingStage.firm_id == firm_id
            )
        )
    ).scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    return stage


async def _active_stages(firm_id: int, db) -> list[SourcingStage]:
    return list(
        (
            await db.execute(
                select(SourcingStage)
                .where(
                    SourcingStage.firm_id == firm_id,
                    SourcingStage.archived_at.is_(None),
                )
                .order_by(SourcingStage.sort_order, SourcingStage.id)
            )
        )
        .scalars()
        .all()
    )


@router.get("")
async def list_stages(db: SessionDep, current_user: CurrentUser):
    """The firm's ordered funnel stages (self-seeds the 5 defaults on first read)."""
    stages = await get_firm_stages(db, current_user.firm_id)
    await db.commit()
    return {
        "items": [SourcingStageRead.model_validate(s).model_dump() for s in stages],
        "total": len(stages),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_stage(
    body: SourcingStageCreate, db: SessionDep, current_user: PartnerDep
):
    sort_order = body.sort_order
    if sort_order is None:
        current = await _active_stages(current_user.firm_id, db)
        sort_order = (max((s.sort_order for s in current), default=0)) + 10
    stage = SourcingStage(
        firm_id=current_user.firm_id,
        name=body.name,
        kind=body.kind,
        sort_order=sort_order,
    )
    db.add(stage)
    await db.flush()
    validate_stage_invariants(await _active_stages(current_user.firm_id, db))
    await db.commit()
    await db.refresh(stage)
    return SourcingStageRead.model_validate(stage).model_dump()


@router.patch("/{stage_id}")
async def update_stage(
    stage_id: int,
    body: SourcingStageUpdate,
    db: SessionDep,
    current_user: PartnerDep,
):
    stage = await _get_stage(stage_id, current_user.firm_id, db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(stage, field, val)
    await db.flush()
    validate_stage_invariants(await _active_stages(current_user.firm_id, db))
    await db.commit()
    await db.refresh(stage)
    return SourcingStageRead.model_validate(stage).model_dump()


@router.delete("/{stage_id}", status_code=status.HTTP_200_OK)
async def archive_stage(stage_id: int, db: SessionDep, current_user: PartnerDep):
    """Soft-delete a stage; its candidates fall back to the first remaining stage.

    Rejected if it would break the funnel invariants (e.g. removing the only PASSED).
    """
    stage = await _get_stage(stage_id, current_user.firm_id, db)
    stage.archived_at = datetime.now(timezone.utc)
    await db.flush()

    remaining = await _active_stages(current_user.firm_id, db)
    if not remaining:
        raise HTTPException(status_code=422, detail="Cannot remove the last stage")
    validate_stage_invariants(remaining)

    fallback = remaining[0]
    orphans = (
        await db.execute(
            select(SourcingCandidate).where(SourcingCandidate.stage_id == stage_id)
        )
    ).scalars().all()
    for c in orphans:
        c.stage_id = fallback.id

    await db.commit()
    return {"detail": "Stage archived"}
