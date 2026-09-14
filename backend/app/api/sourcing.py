"""Sourcing workspace router — pool search + candidate overlay (SOURCING_LAYER_PLAN §3.3).

Pool browsing is **firm-wide** (the pool is a shared sourcing DB by design): it searches
ALL ``company_profiles`` in the firm, including never-placed inventory —
``visible_mandate_ids()`` is not a filter on the pool itself. Each row is overlaid with the
candidate state for the chosen mandate (stage + AI score, left-joined) and **batched**
warm history, whose per-touch detail respects visibility.

Push (§3.4) and scoring (§3.6) also mount here — added in later slices.
"""

from __future__ import annotations

import csv
import io
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import and_, exists, func, null, or_, select

from app.core.config import settings
from app.core.deps import CurrentUser, PartnerDep, SessionDep, visible_mandate_ids
from app.core.time import utcnow
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.enums import (
    ActivityObjectType,
    ActivityVerb,
    CandidateScoreStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    SourcingStageKind,
    UserRole,
)
from app.models.mandate import Mandate
from app.models.project import Project
from app.models.sourcing_candidate import SourcingCandidate
from app.schemas.sourcing_candidate import SourcingCandidateRead
from app.services import activity
from app.services.profiles import compute_domain_key
from app.services.providers import get_ranking_provider
from app.services.providers.mock import MockRankingProvider
from app.services.scoring import (
    PROMPT_VERSION,
    build_candidate_facts,
    build_thesis,
    compute_inputs_hash,
)
from app.services.sourcing import (
    build_warm_history,
    first_stage_of_kind,
    get_firm_stages,
    get_or_create_candidate,
    push_to_mandate,
)

router = APIRouter(prefix="/sourcing", tags=["sourcing"])


async def _assert_mandate_visible(mandate_id: int, db, current_user) -> Mandate:
    visible = await visible_mandate_ids(current_user, db)
    q = select(Mandate).where(
        Mandate.id == mandate_id,
        Mandate.firm_id == current_user.firm_id,
        Mandate.archived_at.is_(None),
    )
    if visible is not None:
        q = q.where(Mandate.id.in_(visible))
    mandate = (await db.execute(q)).scalar_one_or_none()
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate


def _dec(v: str | None) -> Decimal | None:
    if v is None:
        return None
    try:
        return Decimal(v)
    except (InvalidOperation, ValueError):
        return None


# The sector facet's name for "no sector recorded". A company that arrived on a client
# sheet carrying no such column is a real, filterable state — not a row to hide — so the
# lens counts it and this sentinel lets a click narrow to it.
UNCLASSIFIED = "__unclassified__"

# Revenue size bands (₹ Cr) — lower-inclusive / upper-exclusive so every profile
# lands in exactly ONE band. The same table drives the facet counts and the
# ``rev_band`` pool filter, so a lens count can never disagree with a click result.
REV_BANDS: dict[str, tuple[str, Decimal | None, Decimal | None]] = {
    "lt100": ("< ₹100 Cr", None, Decimal(100)),
    "b100_500": ("₹100–500 Cr", Decimal(100), Decimal(500)),
    "b500_2000": ("₹500–2,000 Cr", Decimal(500), Decimal(2000)),
    "gte2000": ("> ₹2,000 Cr", Decimal(2000), None),
}


def _rev_band_conditions(band: str) -> list:
    _, lo, hi = REV_BANDS[band]
    out = []
    if lo is not None:
        out.append(CompanyProfile.revenue_inr_cr >= lo)
    if hi is not None:
        out.append(CompanyProfile.revenue_inr_cr < hi)
    if lo is None:
        # An open lower bound still excludes unknown revenue explicitly.
        out.append(CompanyProfile.revenue_inr_cr.is_not(None))
    return out


def _pool_conditions(
    firm_id: int,
    *,
    q: str | None,
    hq: str | None,
    category_id: int | None,
    ctype: CompanyType | None,
    rev_min: str | None,
    rev_max: str | None,
    headcount_min: int | None,
    headcount_max: int | None,
    rev_band: str | None = None,
    warm_only: bool = False,
    segment: str | None = None,
    sector: str | None = None,
) -> list:
    conditions = [
        CompanyProfile.firm_id == firm_id,
        CompanyProfile.archived_at.is_(None),
    ]
    # segment / sector live on the profile, so they narrow the database itself — unlike
    # category and type below, which can only ask "has a placement like this" and are
    # therefore blind to every company the firm has never put on a deal.
    if segment:
        conditions.append(CompanyProfile.segment == segment)
    if sector:
        conditions.append(
            CompanyProfile.sector.is_(None)
            if sector == UNCLASSIFIED
            else CompanyProfile.sector == sector
        )
    if q:
        like = f"%{q}%"
        domain = compute_domain_key(q)
        clauses = [CompanyProfile.company_name.ilike(like), CompanyProfile.hq.ilike(like)]
        if domain:
            clauses.append(CompanyProfile.domain_key == domain)
        conditions.append(or_(*clauses))
    if hq:
        conditions.append(CompanyProfile.hq.ilike(f"%{hq}%"))
    if (rmin := _dec(rev_min)) is not None:
        conditions.append(CompanyProfile.revenue_inr_cr >= rmin)
    if (rmax := _dec(rev_max)) is not None:
        conditions.append(CompanyProfile.revenue_inr_cr <= rmax)
    if headcount_min is not None:
        conditions.append(CompanyProfile.headcount >= headcount_min)
    if headcount_max is not None:
        conditions.append(CompanyProfile.headcount <= headcount_max)
    if rev_band is not None:
        conditions.extend(_rev_band_conditions(rev_band))
    # "Worked before": the profile has at least one placement in any deal — the same
    # placement set that build_warm_history reads, so the chip and the filter agree.
    if warm_only:
        conditions.append(
            exists().where(
                and_(
                    Company.profile_id == CompanyProfile.id,
                    Company.archived_at.is_(None),
                )
            )
        )
    # category / type filter against ANY placement of this profile (pool has no category).
    if category_id is not None:
        conditions.append(
            exists().where(
                and_(
                    Company.profile_id == CompanyProfile.id,
                    Company.category_id == category_id,
                    Company.archived_at.is_(None),
                )
            )
        )
    if ctype is not None:
        conditions.append(
            exists().where(
                and_(
                    Company.profile_id == CompanyProfile.id,
                    Company.type == ctype,
                    Company.archived_at.is_(None),
                )
            )
        )
    return conditions


async def _run_pool_search(
    db,
    current_user,
    *,
    mandate_id: int | None,
    q: str | None,
    hq: str | None,
    category_id: int | None,
    ctype: CompanyType | None,
    rev_min: str | None,
    rev_max: str | None,
    headcount_min: int | None,
    headcount_max: int | None,
    has_score: bool,
    sort: str,
    page: int,
    page_size: int,
    rev_band: str | None = None,
    warm_only: bool = False,
    segment: str | None = None,
    sector: str | None = None,
) -> dict:
    # mandate_id is optional: without one this is the firm's standing company database
    # (browse + search the pool itself), with no per-deal candidate overlay to compute.
    if mandate_id is not None:
        await _assert_mandate_visible(mandate_id, db, current_user)
    firm_id = current_user.firm_id
    conditions = _pool_conditions(
        firm_id,
        q=q,
        hq=hq,
        category_id=category_id,
        ctype=ctype,
        rev_min=rev_min,
        rev_max=rev_max,
        headcount_min=headcount_min,
        headcount_max=headcount_max,
        rev_band=rev_band,
        warm_only=warm_only,
        segment=segment,
        sector=sector,
    )

    # Left-join the candidate for THIS mandate so we can overlay + sort by AI score.
    # With no mandate the join is skipped entirely — there is no deal to be a candidate
    # *for*, so every row comes back as plain pool inventory.
    if mandate_id is None:
        base = select(CompanyProfile, null().label("candidate")).where(*conditions)
    else:
        join_on = and_(
            SourcingCandidate.profile_id == CompanyProfile.id,
            SourcingCandidate.mandate_id == mandate_id,
            SourcingCandidate.archived_at.is_(None),
        )
        base = (
            select(CompanyProfile, SourcingCandidate)
            .outerjoin(SourcingCandidate, join_on)
            .where(*conditions)
        )
        if has_score:
            base = base.where(SourcingCandidate.fit_score.is_not(None))

    if sort == "score" and mandate_id is not None:
        base = base.order_by(
            SourcingCandidate.fit_score.desc().nullslast(), CompanyProfile.company_name
        )
    elif sort == "rev":
        base = base.order_by(
            CompanyProfile.revenue_inr_cr.desc().nullslast(), CompanyProfile.company_name
        )
    else:
        base = base.order_by(CompanyProfile.company_name)

    total = (
        await db.execute(
            select(func.count()).select_from(base.order_by(None).subquery())
        )
    ).scalar() or 0

    rows = (
        await db.execute(base.offset((page - 1) * page_size).limit(page_size))
    ).all()

    profile_ids = [p.id for p, _ in rows]
    visible = await visible_mandate_ids(current_user, db)
    warm = await build_warm_history(
        db, firm_id=firm_id, profile_ids=profile_ids, visible=visible
    )
    stages = {s.id: s for s in await get_firm_stages(db, firm_id)}

    items = []
    for profile, cand in rows:
        candidate = None
        if cand is not None and mandate_id is not None:
            stage = stages.get(cand.stage_id)
            candidate = {
                "id": cand.id,
                "stage_id": cand.stage_id,
                "stage_name": stage.name if stage else None,
                "stage_kind": stage.kind.value if stage else None,
                "company_id": cand.company_id,
                "fit_score": cand.fit_score,
                "band": cand.band,
                "subscores": cand.subscores,
                "rationale": cand.rationale,
                "insufficient_data": cand.insufficient_data,
                "score_status": cand.score_status.value if cand.score_status else None,
            }
        items.append(
            {
                "profile_id": profile.id,
                "company_name": profile.company_name,
                "hq": profile.hq,
                "website": profile.website,
                "linkedin": profile.linkedin,
                "segment": profile.segment,
                "sector": profile.sector,
                "headcount": profile.headcount,
                "revenue_inr_cr": (
                    str(profile.revenue_inr_cr) if profile.revenue_inr_cr is not None else None
                ),
                "domain_key": profile.domain_key,
                "candidate": candidate,
                "warm_history": warm.get(profile.id, []),
            }
        )

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def _profile_for_firm(profile_id: int, firm_id: int, db) -> CompanyProfile:
    profile = (
        await db.execute(
            select(CompanyProfile).where(
                CompanyProfile.id == profile_id,
                CompanyProfile.firm_id == firm_id,
                CompanyProfile.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


class PushBody(BaseModel):
    profile_id: int
    project_id: int
    side: MandateType
    mandate_id: int | None = None  # disambiguates when several engagements of the side


@router.post("/push")
async def push_to_project_side(
    body: PushBody, db: SessionDep, current_user: CurrentUser
):
    """Push a pool profile into a project's engagement of the chosen side (§3.4).

    Runs the full resolution matrix (auto-push / choose-engagement / offer-create[partner]
    / already-present) — all visibility-scoped. Never duplicates.
    """
    profile = await _profile_for_firm(body.profile_id, current_user.firm_id, db)

    project = (
        await db.execute(
            select(Project).where(
                Project.id == body.project_id,
                Project.firm_id == current_user.firm_id,
                Project.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    visible = await visible_mandate_ids(current_user, db)

    # All non-archived mandates in the project the analyst may see.
    proj_conditions = [
        Mandate.project_id == project.id,
        Mandate.firm_id == current_user.firm_id,
        Mandate.archived_at.is_(None),
    ]
    if visible is not None:
        proj_conditions.append(Mandate.id.in_(visible))
    project_mandates = list(
        (await db.execute(select(Mandate).where(*proj_conditions))).scalars().all()
    )
    side_mandates = [m for m in project_mandates if m.type == body.side]
    existing_sides = sorted({m.type.value for m in project_mandates})

    # Resolve which engagement to push into.
    target: Mandate | None = None
    if body.mandate_id is not None:
        target = next((m for m in side_mandates if m.id == body.mandate_id), None)
        if target is None:
            raise HTTPException(status_code=404, detail="Engagement not found for this side")
    elif len(side_mandates) == 1:
        target = side_mandates[0]
    elif len(side_mandates) > 1:
        return {
            "needs_choice": [
                {
                    "mandate_id": m.id,
                    "name": m.name,
                    "client_name": m.client_name,
                    "type": m.type.value,
                }
                for m in side_mandates
            ]
        }
    else:
        return {
            "can_create": current_user.role == UserRole.PARTNER,
            "existing_sides": existing_sides,
            "project_id": project.id,
            "side": body.side.value,
        }

    result = await push_to_mandate(
        db,
        firm_id=current_user.firm_id,
        profile=profile,
        mandate=target,
        actor_id=current_user.id,
    )
    company = result["company"]
    if result["already_present"]:
        await db.commit()
        return {
            "already_present": True,
            "company_id": company.id,
            "mandate_id": target.id,
        }

    warm = await build_warm_history(
        db, firm_id=current_user.firm_id, profile_ids=[profile.id], visible=visible
    )
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.CANDIDATE_PUSHED,
        object_type=ActivityObjectType.SOURCING_CANDIDATE,
        object_id=company.id,
        object_label=company.company_name,
        project_id=target.project_id,
        mandate_id=target.id,
        company_id=company.id,
        meta={"side": target.type.value, "engagement": target.name},
    )
    await db.commit()
    return {
        "pushed": True,
        "company_id": company.id,
        "mandate_id": target.id,
        "prompt_log_initial": result["prompt_log_initial"],
        "warm_history": warm.get(profile.id, []),
    }


class EngagementBody(BaseModel):
    project_id: int
    side: MandateType
    name: str | None = None


@router.post("/engagements", status_code=201)
async def create_engagement(
    body: EngagementBody, db: SessionDep, current_user: PartnerDep
):
    """Partner-only: create an engagement of a side under a project when none exists,
    returning the new mandate_id for an immediate push (§3.4)."""
    project = (
        await db.execute(
            select(Project).where(
                Project.id == body.project_id,
                Project.firm_id == current_user.firm_id,
                Project.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    side_label = {
        MandateType.SELL_SIDE: "Sell-side",
        MandateType.BUY_SIDE: "Buy-side",
        MandateType.CAPITAL_RAISE: "Capital raise",
    }[body.side]
    mandate = Mandate(
        firm_id=current_user.firm_id,
        project_id=project.id,
        client_name=project.client_name,
        name=body.name or f"{project.client_name} — {side_label}",
        type=body.side,
        status=MandateStatus.ACTIVE,
        lead_owner_id=current_user.id,
    )
    db.add(mandate)
    await db.commit()
    await db.refresh(mandate)
    return {"mandate_id": mandate.id, "name": mandate.name, "type": mandate.type.value}


class AddCandidateBody(BaseModel):
    mandate_id: int
    profile_id: int
    stage_kind: SourcingStageKind = SourcingStageKind.RESEARCH


@router.post("/candidates", status_code=201)
async def add_candidate(
    body: AddCandidateBody, db: SessionDep, current_user: CurrentUser
):
    """Add a pool profile to a mandate's funnel (Add-to-long-list / Shortlist action).

    Creates the (mandate × profile) candidate at the requested pre-push stage
    (RESEARCH or SHORTLIST). Idempotent via unique (mandate_id, profile_id).
    """
    if body.stage_kind not in (SourcingStageKind.RESEARCH, SourcingStageKind.SHORTLIST):
        raise HTTPException(
            status_code=422, detail="Only RESEARCH or SHORTLIST stages can be set directly"
        )
    await _assert_mandate_visible(body.mandate_id, db, current_user)
    profile = (
        await db.execute(
            select(CompanyProfile).where(
                CompanyProfile.id == body.profile_id,
                CompanyProfile.firm_id == current_user.firm_id,
                CompanyProfile.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    stages = await get_firm_stages(db, current_user.firm_id)
    stage = first_stage_of_kind(stages, body.stage_kind)
    if stage is None:
        raise HTTPException(status_code=422, detail="No stage of that kind configured")
    candidate, created = await get_or_create_candidate(
        db,
        firm_id=current_user.firm_id,
        mandate_id=body.mandate_id,
        profile_id=body.profile_id,
        stage=stage,
        actor_id=current_user.id,
    )
    # An explicit shortlist should advance an existing Research candidate.
    if not created and body.stage_kind == SourcingStageKind.SHORTLIST:
        current = next((s for s in stages if s.id == candidate.stage_id), None)
        if current is not None and current.kind == SourcingStageKind.RESEARCH:
            candidate.stage_id = stage.id
    await db.commit()
    await db.refresh(candidate)
    result = SourcingCandidateRead.model_validate(candidate).model_dump()
    result["created"] = created
    result["stage_kind"] = stage.kind.value
    result["stage_name"] = stage.name
    return result


class BulkCandidateBody(BaseModel):
    mandate_id: int
    profile_ids: list[int]
    stage_kind: SourcingStageKind = SourcingStageKind.SHORTLIST


@router.post("/candidates/bulk", status_code=201)
async def bulk_add_candidates(
    body: BulkCandidateBody, db: SessionDep, current_user: CurrentUser
):
    """Bulk add/advance pool profiles into a mandate funnel (bulk Shortlist, §4.1).

    Returns the affected candidate ids so the UI can offer Undo.
    """
    if body.stage_kind not in (SourcingStageKind.RESEARCH, SourcingStageKind.SHORTLIST):
        raise HTTPException(status_code=422, detail="Bulk only supports RESEARCH or SHORTLIST")
    await _assert_mandate_visible(body.mandate_id, db, current_user)
    stages = await get_firm_stages(db, current_user.firm_id)
    stage = first_stage_of_kind(stages, body.stage_kind)
    if stage is None:
        raise HTTPException(status_code=422, detail="No stage of that kind configured")

    valid_ids = {
        r[0]
        for r in (
            await db.execute(
                select(CompanyProfile.id).where(
                    CompanyProfile.id.in_(body.profile_ids),
                    CompanyProfile.firm_id == current_user.firm_id,
                    CompanyProfile.archived_at.is_(None),
                )
            )
        ).all()
    }
    affected: list[int] = []
    for pid in body.profile_ids:
        if pid not in valid_ids:
            continue
        candidate, created = await get_or_create_candidate(
            db,
            firm_id=current_user.firm_id,
            mandate_id=body.mandate_id,
            profile_id=pid,
            stage=stage,
            actor_id=current_user.id,
        )
        if not created and body.stage_kind == SourcingStageKind.SHORTLIST:
            cur = next((s for s in stages if s.id == candidate.stage_id), None)
            if cur is not None and cur.kind == SourcingStageKind.RESEARCH:
                candidate.stage_id = stage.id
        affected.append(candidate.id)
    await db.commit()
    return {"candidate_ids": affected, "count": len(affected)}


@router.get("/board")
async def kanban_board(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int = Query(...),
):
    """Kanban data: the mandate's candidates grouped by funnel stage (§4.1)."""
    await _assert_mandate_visible(mandate_id, db, current_user)
    stages = await get_firm_stages(db, current_user.firm_id)

    rows = (
        await db.execute(
            select(SourcingCandidate, CompanyProfile)
            .join(CompanyProfile, CompanyProfile.id == SourcingCandidate.profile_id)
            .where(
                SourcingCandidate.mandate_id == mandate_id,
                SourcingCandidate.firm_id == current_user.firm_id,
                SourcingCandidate.archived_at.is_(None),
            )
        )
    ).all()

    by_stage: dict[int, list[dict]] = {}
    for cand, profile in rows:
        by_stage.setdefault(cand.stage_id, []).append(
            {
                "id": cand.id,
                "profile_id": cand.profile_id,
                "company_name": profile.company_name,
                "hq": profile.hq,
                "revenue_inr_cr": (
                    str(profile.revenue_inr_cr) if profile.revenue_inr_cr is not None else None
                ),
                "company_id": cand.company_id,
                "fit_score": cand.fit_score,
                "band": cand.band,
                "insufficient_data": cand.insufficient_data,
                "stage_id": cand.stage_id,
            }
        )

    columns = [
        {
            "stage": {
                "id": s.id,
                "name": s.name,
                "kind": s.kind.value,
                "sort_order": s.sort_order,
            },
            "candidates": by_stage.get(s.id, []),
            "count": len(by_stage.get(s.id, [])),
        }
        for s in stages
    ]
    return {"columns": columns}


@router.get("/candidates")
async def search_candidates(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int | None = Query(
        default=None,
        description="Mandate context for the candidate overlay. Omit to browse the "
        "firm's standing company database with no deal selected.",
    ),
    q: str | None = Query(default=None),
    hq: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    type: CompanyType | None = Query(default=None),
    rev_min: str | None = Query(default=None),
    rev_max: str | None = Query(default=None),
    headcount_min: int | None = Query(default=None),
    headcount_max: int | None = Query(default=None),
    has_score: bool = Query(default=False),
    rev_band: str | None = Query(
        default=None, description="lt100 | b100_500 | b500_2000 | gte2000"
    ),
    warm_only: bool = Query(default=False, description="Only profiles with prior placements"),
    segment: str | None = Query(
        default=None, description="Profile-level side of the market: TARGET | BUYER | INVESTOR"
    ),
    sector: str | None = Query(
        default=None,
        description=f"Profile-level research bucket; '{UNCLASSIFIED}' for rows with none",
    ),
    sort: str = Query(default="name", description="score | name | rev"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
):
    if rev_band is not None and rev_band not in REV_BANDS:
        raise HTTPException(status_code=422, detail="Unknown rev_band")
    return await _run_pool_search(
        db,
        current_user,
        mandate_id=mandate_id,
        q=q,
        hq=hq,
        category_id=category_id,
        ctype=type,
        rev_min=rev_min,
        rev_max=rev_max,
        headcount_min=headcount_min,
        headcount_max=headcount_max,
        has_score=has_score,
        sort=sort,
        page=page,
        page_size=page_size,
        rev_band=rev_band,
        warm_only=warm_only,
        segment=segment,
        sector=sector,
    )


@router.get("/candidates.csv", response_class=PlainTextResponse)
async def export_candidates(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int = Query(...),
    q: str | None = Query(default=None),
    hq: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    type: CompanyType | None = Query(default=None),
    rev_min: str | None = Query(default=None),
    rev_max: str | None = Query(default=None),
    headcount_min: int | None = Query(default=None),
    headcount_max: int | None = Query(default=None),
    has_score: bool = Query(default=False),
    rev_band: str | None = Query(default=None),
    warm_only: bool = Query(default=False),
    segment: str | None = Query(default=None),
    sector: str | None = Query(default=None),
    sort: str = Query(default="name"),
):
    if rev_band is not None and rev_band not in REV_BANDS:
        raise HTTPException(status_code=422, detail="Unknown rev_band")
    data = await _run_pool_search(
        db,
        current_user,
        mandate_id=mandate_id,
        q=q,
        hq=hq,
        category_id=category_id,
        ctype=type,
        rev_min=rev_min,
        rev_max=rev_max,
        headcount_min=headcount_min,
        headcount_max=headcount_max,
        has_score=has_score,
        sort=sort,
        page=1,
        page_size=200,
        rev_band=rev_band,
        warm_only=warm_only,
        segment=segment,
        sector=sector,
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Company",
            "HQ",
            "Segment",
            "Sector",
            "Website",
            "Headcount",
            "Revenue (INR Cr)",
            "Stage",
            "Fit score",
        ]
    )
    for it in data["items"]:
        cand = it["candidate"] or {}
        writer.writerow(
            [
                it["company_name"],
                it["hq"] or "",
                it["segment"] or "",
                it["sector"] or "",
                it["website"] or "",
                it["headcount"] if it["headcount"] is not None else "",
                it["revenue_inr_cr"] or "",
                cand.get("stage_name") or "",
                cand.get("fit_score") if cand.get("fit_score") is not None else "",
            ]
        )
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sourcing_candidates.csv"},
    )


@router.get("/facets")
async def pool_facets(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int | None = Query(
        default=None, description="Adds scored coverage for this mandate"
    ),
):
    """Composition of the firm-wide pool — the Discover lens.

    Cheap read-only group-bys over the shared pool: segment and sector (profile-level, so
    they read the whole database), category mix (via placements — a placement is the only
    thing that has a category), top HQ cities, revenue size bands, and the warm-door count
    (profiles with any prior placement). ``scored`` is per-mandate when a mandate is given.
    Firm-wide by design, like the pool itself.
    """
    firm_id = current_user.firm_id
    pool_where = [CompanyProfile.firm_id == firm_id, CompanyProfile.archived_at.is_(None)]

    total = (
        await db.execute(select(func.count()).select_from(CompanyProfile).where(*pool_where))
    ).scalar() or 0

    seg_rows = (
        await db.execute(
            select(CompanyProfile.segment, func.count())
            .where(*pool_where, CompanyProfile.segment.is_not(None))
            .group_by(CompanyProfile.segment)
            .order_by(func.count().desc(), CompanyProfile.segment)
        )
    ).all()
    by_segment = [{"segment": s, "count": n} for s, n in seg_rows]

    sector_rows = (
        await db.execute(
            select(CompanyProfile.sector, func.count())
            .where(*pool_where, CompanyProfile.sector.is_not(None))
            .group_by(CompanyProfile.sector)
            .order_by(func.count().desc(), CompanyProfile.sector)
            .limit(8)
        )
    ).all()
    by_sector = [{"sector": s, "label": s, "count": n} for s, n in sector_rows]
    # Rows with no sector are the honest remainder of an import — countable and clickable
    # rather than quietly missing from a lens that claims to read the whole database.
    unclassified = (
        await db.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(*pool_where, CompanyProfile.sector.is_(None))
        )
    ).scalar() or 0
    if unclassified:
        by_sector.append(
            {"sector": UNCLASSIFIED, "label": "Unclassified", "count": unclassified}
        )

    from app.models.company_category import CompanyCategoryVocab

    cat_count = func.count(func.distinct(Company.profile_id))
    cat_rows = (
        await db.execute(
            select(Company.category_id, CompanyCategoryVocab.name, cat_count)
            .join(CompanyCategoryVocab, CompanyCategoryVocab.id == Company.category_id)
            .join(CompanyProfile, CompanyProfile.id == Company.profile_id)
            .where(
                Company.firm_id == firm_id,
                Company.archived_at.is_(None),
                CompanyProfile.archived_at.is_(None),
            )
            .group_by(Company.category_id, CompanyCategoryVocab.name)
            .order_by(cat_count.desc(), CompanyCategoryVocab.name)
        )
    ).all()
    by_category = [{"id": cid, "name": name, "count": n} for cid, name, n in cat_rows]

    hq_rows = (
        await db.execute(
            select(CompanyProfile.hq, func.count())
            .where(*pool_where, CompanyProfile.hq.is_not(None), CompanyProfile.hq != "")
            .group_by(CompanyProfile.hq)
            .order_by(func.count().desc(), CompanyProfile.hq)
            .limit(8)
        )
    ).all()
    by_hq = [{"hq": h, "count": n} for h, n in hq_rows]

    size_bands = []
    for key, (label, _lo, _hi) in REV_BANDS.items():
        n = (
            await db.execute(
                select(func.count())
                .select_from(CompanyProfile)
                .where(*pool_where, *_rev_band_conditions(key))
            )
        ).scalar() or 0
        size_bands.append({"key": key, "label": label, "count": n})

    warm = (
        await db.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(
                *pool_where,
                exists().where(
                    and_(
                        Company.profile_id == CompanyProfile.id,
                        Company.archived_at.is_(None),
                    )
                ),
            )
        )
    ).scalar() or 0

    # How much of the database is actually filled in. On a firm's first day the shipped
    # dataset carries names, cities and domains but no financials — so the lens says so
    # out loud instead of rendering four empty revenue bands and looking broken. Every
    # import raises these numbers, which makes the honest read also the useful prompt.
    async def _filled(column) -> int:
        return (
            await db.execute(
                select(func.count())
                .select_from(CompanyProfile)
                .where(*pool_where, column.is_not(None))
            )
        ).scalar() or 0

    coverage = {
        "revenue": await _filled(CompanyProfile.revenue_inr_cr),
        "headcount": await _filled(CompanyProfile.headcount),
        "website": await _filled(CompanyProfile.domain_key),
    }

    scored = 0
    if mandate_id is not None:
        await _assert_mandate_visible(mandate_id, db, current_user)
        scored = (
            await db.execute(
                select(func.count(func.distinct(SourcingCandidate.profile_id))).where(
                    SourcingCandidate.mandate_id == mandate_id,
                    SourcingCandidate.firm_id == firm_id,
                    SourcingCandidate.archived_at.is_(None),
                    SourcingCandidate.fit_score.is_not(None),
                )
            )
        ).scalar() or 0

    return {
        "total": total,
        "by_segment": by_segment,
        "by_sector": by_sector,
        "by_category": by_category,
        "by_hq": by_hq,
        "size_bands": size_bands,
        "coverage": coverage,
        "warm": warm,
        "scored": scored,
    }


# ── AI ranking (SOURCING_LAYER_PLAN §3.6 / §5) ────────────────────────────────


async def _resolve_ranking_provider(db, firm_id: int):
    """Pick the ranking provider, degrading to the mock when AI is off/unconfigured.

    Groq is used only when the firm's data-source row selects it AND ``sourcing_ai_enabled``
    + keys are set (§5.7 confidentiality gate). Otherwise the mock keeps the app working.
    """
    provider = await get_ranking_provider(db, firm_id)
    if provider.key == "groq_ranking" and not (
        settings.sourcing_ai_enabled and settings.groq_api_keys
    ):
        return MockRankingProvider()
    return provider


class ScoreBody(BaseModel):
    mandate_id: int
    profile_ids: list[int] | None = None


@router.post("/score")
async def score_candidates(
    body: ScoreBody, response: Response, db: SessionDep, current_user: CurrentUser
):
    """Batched, cached AI scoring for a mandate's candidates (§3.6).

    Creates candidate rows at RESEARCH as the scoring side-effect, caches by
    ``inputs_hash`` (no re-call on a hit), and degrades gracefully — a provider failure
    marks affected candidates FAILED (keeping the last good score) and returns 202.
    """
    mandate = await _assert_mandate_visible(body.mandate_id, db, current_user)
    firm_id = current_user.firm_id
    thesis = build_thesis(mandate)
    provider = await _resolve_ranking_provider(db, firm_id)
    model_name = settings.groq_model if provider.key == "groq_ranking" else provider.key

    # Which profiles? Explicit ids, else the mandate's existing candidates.
    if body.profile_ids:
        profile_ids = list(dict.fromkeys(body.profile_ids))
    else:
        profile_ids = [
            r[0]
            for r in (
                await db.execute(
                    select(SourcingCandidate.profile_id).where(
                        SourcingCandidate.mandate_id == mandate.id,
                        SourcingCandidate.firm_id == firm_id,
                        SourcingCandidate.archived_at.is_(None),
                    )
                )
            ).all()
        ]
    if not profile_ids:
        return {"scored": 0, "cached": 0, "failed": 0, "degraded": False, "provider": provider.key}

    profiles = {
        p.id: p
        for p in (
            await db.execute(
                select(CompanyProfile).where(
                    CompanyProfile.id.in_(profile_ids),
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.archived_at.is_(None),
                )
            )
        ).scalars().all()
    }

    stages = await get_firm_stages(db, firm_id)
    research = first_stage_of_kind(stages, SourcingStageKind.RESEARCH) or stages[0]

    cached = 0
    to_score: list[tuple[SourcingCandidate, object, str]] = []  # (candidate, facts, hash)
    for pid in profile_ids:
        profile = profiles.get(pid)
        if profile is None:
            continue
        candidate, _ = await get_or_create_candidate(
            db,
            firm_id=firm_id,
            mandate_id=mandate.id,
            profile_id=pid,
            stage=research,
            actor_id=current_user.id,
        )
        facts = build_candidate_facts(profile)
        inputs_hash = compute_inputs_hash(thesis, facts, model_name)
        if (
            candidate.inputs_hash == inputs_hash
            and candidate.score_status == CandidateScoreStatus.OK
        ):
            cached += 1
            continue
        to_score.append((candidate, facts, inputs_hash))

    scored = 0
    failed = 0
    degraded = False
    cap = max(1, settings.groq_max_candidates_per_call)
    for start in range(0, len(to_score), cap):
        chunk = to_score[start : start + cap]
        facts_list = [f for _, f, _ in chunk]
        try:
            results = await provider.score(thesis, facts_list)
        except Exception:  # noqa: BLE001 — degrade, never break the request
            degraded = True
            for candidate, _, _ in chunk:
                candidate.score_status = CandidateScoreStatus.FAILED
                failed += 1
            continue
        by_id = {r.profile_id: r for r in results}
        for candidate, facts, inputs_hash in chunk:
            r = by_id.get(facts.profile_id)
            if r is None:
                candidate.score_status = CandidateScoreStatus.FAILED
                failed += 1
                continue
            candidate.fit_score = r.fit_score
            candidate.band = r.band
            candidate.subscores = r.subscores
            candidate.rationale = r.rationale
            candidate.insufficient_data = r.insufficient_data
            candidate.model = model_name
            candidate.prompt_version = PROMPT_VERSION
            candidate.inputs_hash = inputs_hash
            candidate.score_status = CandidateScoreStatus.OK
            candidate.scored_at = utcnow()
            scored += 1

    await db.commit()
    if degraded or failed:
        response.status_code = 202
    return {
        "scored": scored,
        "cached": cached,
        "failed": failed,
        "degraded": degraded,
        "provider": provider.key,
    }


@router.get("/score/status")
async def score_status(
    db: SessionDep, current_user: CurrentUser, mandate_id: int = Query(...)
):
    """Scoring coverage for a mandate: OK / STALE / FAILED / unscored counts."""
    await _assert_mandate_visible(mandate_id, db, current_user)
    rows = (
        await db.execute(
            select(SourcingCandidate.score_status, func.count()).where(
                SourcingCandidate.mandate_id == mandate_id,
                SourcingCandidate.firm_id == current_user.firm_id,
                SourcingCandidate.archived_at.is_(None),
            ).group_by(SourcingCandidate.score_status)
        )
    ).all()
    counts = {"OK": 0, "STALE": 0, "FAILED": 0, "unscored": 0}
    for status_val, cnt in rows:
        counts[status_val.value if status_val is not None else "unscored"] = cnt
    counts["total"] = sum(v for k, v in counts.items() if k != "total")
    return counts


class ScoreFeedbackBody(BaseModel):
    vote: str  # UP | DOWN


@router.post("/candidates/{candidate_id}/score-feedback")
async def score_feedback(
    candidate_id: int,
    body: ScoreFeedbackBody,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Analyst thumbs-up/down on a score — ground truth for later eval (§5.6)."""
    vote = body.vote.upper()
    if vote not in ("UP", "DOWN"):
        raise HTTPException(status_code=422, detail="vote must be UP or DOWN")
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
    candidate.score_feedback = vote
    await db.commit()
    return {"id": candidate.id, "score_feedback": vote}


# ── Funnel analytics + AI eval (SOURCING_LAYER_PLAN §5.6 / SL-9) ───────────────


@router.get("/funnel-analytics")
async def funnel_analytics(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int | None = Query(default=None),
):
    """Response-rate by stage, funnel conversion, pool coverage, AI-fit-vs-outcome.

    Visibility-scoped: analysts see only their mandates' candidates; the pool-coverage
    denominator is the firm-wide pool (a shared inventory by design).
    """
    from app.models.enums import CompanyStatus

    firm_id = current_user.firm_id
    visible = await visible_mandate_ids(current_user, db)

    cand_conditions = [
        SourcingCandidate.firm_id == firm_id,
        SourcingCandidate.archived_at.is_(None),
    ]
    if mandate_id is not None:
        await _assert_mandate_visible(mandate_id, db, current_user)
        cand_conditions.append(SourcingCandidate.mandate_id == mandate_id)
    elif visible is not None:
        cand_conditions.append(SourcingCandidate.mandate_id.in_(visible))

    stages = await get_firm_stages(db, firm_id)
    stage_by_id = {s.id: s for s in stages}

    candidates = list(
        (await db.execute(select(SourcingCandidate).where(*cand_conditions))).scalars().all()
    )

    # Placement statuses (for response-by-stage) batched.
    company_ids = [c.company_id for c in candidates if c.company_id]
    status_by_company: dict[int, str] = {}
    if company_ids:
        for cid, status_val in (
            await db.execute(
                select(Company.id, Company.status).where(Company.id.in_(company_ids))
            )
        ).all():
            status_by_company[cid] = status_val.value if status_val else None

    by_stage: dict[int, dict] = {
        s.id: {"stage_name": s.name, "kind": s.kind.value, "count": 0, "placements": 0, "responded": 0}
        for s in stages
    }
    high = {"n": 0, "responded": 0}
    low = {"n": 0, "responded": 0}
    for c in candidates:
        bucket = by_stage.get(c.stage_id)
        if bucket is None and c.stage_id in stage_by_id:
            bucket = by_stage[c.stage_id]
        if bucket is not None:
            bucket["count"] += 1
            if c.company_id:
                bucket["placements"] += 1
                if status_by_company.get(c.company_id) == CompanyStatus.RESPONDED.value:
                    bucket["responded"] += 1
        if c.fit_score is not None and c.company_id:
            responded = status_by_company.get(c.company_id) == CompanyStatus.RESPONDED.value
            group = high if c.fit_score >= 60 else low
            group["n"] += 1
            group["responded"] += 1 if responded else 0

    response_by_stage = [
        {
            **v,
            "response_rate": round(v["responded"] / v["placements"], 4) if v["placements"] else 0.0,
        }
        for v in by_stage.values()
    ]

    pool_total = (
        await db.execute(
            select(func.count()).select_from(CompanyProfile).where(
                CompanyProfile.firm_id == firm_id, CompanyProfile.archived_at.is_(None)
            )
        )
    ).scalar() or 0
    in_funnel = len({c.profile_id for c in candidates})
    scored = len({c.profile_id for c in candidates if c.fit_score is not None})

    def _rate(g: dict) -> float:
        return round(g["responded"] / g["n"], 4) if g["n"] else 0.0

    return {
        "by_stage": [{"stage_name": v["stage_name"], "kind": v["kind"], "count": v["count"]} for v in by_stage.values()],
        "response_by_stage": response_by_stage,
        "pool_coverage": {"pool_total": pool_total, "in_funnel": in_funnel, "scored": scored},
        "fit_vs_outcome": {
            "high_fit": {**high, "response_rate": _rate(high)},
            "low_fit": {**low, "response_rate": _rate(low)},
        },
    }


@router.post("/score/eval")
async def score_eval(
    db: SessionDep,
    current_user: PartnerDep,
    mandate_id: int | None = Query(default=None),
):
    """Formal eval over analyst thumbs feedback (§5.6): Cohen's κ + Spearman + distribution."""
    from app.services.eval import cohen_kappa, spearman

    conditions = [
        SourcingCandidate.firm_id == current_user.firm_id,
        SourcingCandidate.archived_at.is_(None),
        SourcingCandidate.score_feedback.is_not(None),
        SourcingCandidate.fit_score.is_not(None),
    ]
    if mandate_id is not None:
        conditions.append(SourcingCandidate.mandate_id == mandate_id)
    rows = list(
        (await db.execute(select(SourcingCandidate).where(*conditions))).scalars().all()
    )

    pairs: list[tuple[bool, bool]] = []
    xs: list[float] = []
    ys: list[float] = []
    distribution: dict[str, int] = {}
    for c in rows:
        analyst_pos = c.score_feedback == "UP"
        ai_pos = (c.fit_score or 0) >= 60
        pairs.append((ai_pos, analyst_pos))
        xs.append(float(c.fit_score or 0))
        ys.append(1.0 if analyst_pos else 0.0)
        band = c.band or "UNKNOWN"
        distribution[band] = distribution.get(band, 0) + 1

    return {
        "n": len(rows),
        "cohen_kappa": cohen_kappa(pairs),
        "spearman": spearman(xs, ys),
        "distribution": distribution,
    }
