"""Analytics API — overview, response-by-bucket, by-analyst, sources (§6.5)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, PartnerDep, SessionDep, visible_mandate_ids
from app.services import analytics as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/timeseries")
async def analytics_timeseries(
    db: SessionDep,
    current_user: CurrentUser,
    weeks: int = Query(default=12, ge=2, le=52),
):
    """Weekly outreach volume + responses over the last N weeks (trend + WoW deltas)."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_timeseries(db, current_user.firm_id, mandate_ids, weeks)}


@router.get("/overview")
async def analytics_overview(db: SessionDep, current_user: CurrentUser):
    """KPI overview: totals, by-status, % responded, due-this-week, overdue, needs-initial."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return await svc.get_overview(db, current_user.firm_id, mandate_ids)


@router.get("/response-by-category")
async def response_by_category(db: SessionDep, current_user: CurrentUser):
    """Response rate grouped by counterparty category — Axis 1 (BUG-10)."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_response_by_category(db, current_user.firm_id, mandate_ids)}


@router.get("/response-by-layer")
async def response_by_layer(db: SessionDep, current_user: CurrentUser):
    """Response rate grouped by sourcing layer — Axis 2 (BUG-10)."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_response_by_sourcing_layer(db, current_user.firm_id, mandate_ids)}


@router.get("/response-by-bucket", deprecated=True)
async def response_by_bucket(db: SessionDep, current_user: CurrentUser):
    """DEPRECATED — use /response-by-category. Kept for backward compat (BUG-10)."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_response_by_bucket(db, current_user.firm_id, mandate_ids)}


@router.get("/by-engagement")
async def by_engagement(db: SessionDep, current_user: CurrentUser):
    """Per-engagement response / bounce / emails-sent rollup — visibility-scoped."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_by_engagement(db, current_user.firm_id, mandate_ids)}


@router.get("/by-analyst")
async def by_analyst(db: SessionDep, current_user: PartnerDep):
    """Volume / responses / conversion per analyst — partner only (A-02)."""
    return {"items": await svc.get_by_analyst(db, current_user.firm_id)}


@router.get("/sources")
async def sources(db: SessionDep, current_user: CurrentUser):
    """Counts + response rate by source / source_quality."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return {"items": await svc.get_sources(db, current_user.firm_id, mandate_ids)}


@router.get("/response-latency")
async def response_latency(db: SessionDep, current_user: CurrentUser):
    """Days-to-reply + touches-to-reply distribution (median + buckets) — scoped."""
    mandate_ids = await visible_mandate_ids(current_user, db)
    return await svc.get_response_latency(db, current_user.firm_id, mandate_ids)


@router.get("/projects")
async def analytics_projects(db: SessionDep, current_user: PartnerDep):
    """Per-project + per-engagement health — partner only (Slice 5)."""
    return {"items": await svc.get_project_analytics(db, current_user.firm_id)}
