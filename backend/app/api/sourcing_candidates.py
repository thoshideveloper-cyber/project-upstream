"""Sourcing candidates router — the funnel entity (mandate × profile).

Currently exposes the stage-transition endpoint (SOURCING_LAYER_PLAN §3.1); pool search,
push and scoring live on the ``/sourcing`` router. Every access is visibility-scoped:
an analyst may only touch candidates in a mandate they are assigned to.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_stage import SourcingStage
from app.schemas.sourcing_candidate import (
    SourcingCandidateRead,
    SourcingCandidateStageUpdate,
)
from app.services.sourcing import apply_stage_transition

router = APIRouter(prefix="/sourcing-candidates", tags=["sourcing-candidates"])


async def _get_visible_candidate(
    candidate_id: int, db, current_user
) -> SourcingCandidate:
    visible = await visible_mandate_ids(current_user, db)
    q = select(SourcingCandidate).where(
        SourcingCandidate.id == candidate_id,
        SourcingCandidate.firm_id == current_user.firm_id,
        SourcingCandidate.archived_at.is_(None),
    )
    if visible is not None:
        q = q.where(SourcingCandidate.mandate_id.in_(visible))
    candidate = (await db.execute(q)).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.patch("/{candidate_id}/stage")
async def change_stage(
    candidate_id: int,
    body: SourcingCandidateStageUpdate,
    db: SessionDep,
    current_user: CurrentUser,
):
    candidate = await _get_visible_candidate(candidate_id, db, current_user)

    stages = list(
        (
            await db.execute(
                select(SourcingStage)
                .where(
                    SourcingStage.firm_id == current_user.firm_id,
                    SourcingStage.archived_at.is_(None),
                )
                .order_by(SourcingStage.sort_order, SourcingStage.id)
            )
        )
        .scalars()
        .all()
    )
    target = next((s for s in stages if s.id == body.stage_id), None)
    if target is None:
        raise HTTPException(status_code=422, detail="Invalid stage_id")

    effects = await apply_stage_transition(
        db,
        candidate=candidate,
        target_stage=target,
        stages=stages,
        actor_id=current_user.id,
    )
    await db.commit()
    await db.refresh(candidate)

    result = SourcingCandidateRead.model_validate(candidate).model_dump()
    result["stage_name"] = target.name
    result["stage_kind"] = target.kind.value
    result.update(effects)
    return result
