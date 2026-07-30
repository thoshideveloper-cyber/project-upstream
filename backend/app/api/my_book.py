"""My-book router — the analyst worklist (SOURCING_LAYER_PLAN §3.5 / §4.4).

Placements in the caller's visible mandates, grouped by Project and sorted by attention
(overdue → due-soon → awaiting-initial → rest). Cadence is batched (reuses the companies
enrichment) and computed with ``today_ist()`` — the frontend never recomputes it.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.companies import _enrich_companies_batch
from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.models.company import Company
from app.models.enums import ScheduleStatus
from app.models.mandate import Mandate
from app.models.project import Project

router = APIRouter(prefix="/my-book", tags=["my-book"])


def _attention_rank(item: dict) -> tuple[int, int]:
    """Sort key: overdue → due-soon(active) → awaiting-initial → rest, then by urgency."""
    ss = item.get("schedule_status")
    ss_val = ss.value if hasattr(ss, "value") else ss
    days = item.get("days_remaining")
    if item.get("is_overdue"):
        return (0, days if days is not None else 0)
    if ss_val == ScheduleStatus.ACTIVE.value:
        return (1, days if days is not None else 9999)
    if ss_val == ScheduleStatus.AWAITING_INITIAL.value:
        return (2, 0)
    return (3, 0)


@router.get("")
async def my_book(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int | None = Query(default=None),
):
    """Analyst default view: placements in my mandates, grouped by Project, attention-sorted."""
    visible = await visible_mandate_ids(current_user, db)

    conditions = [
        Company.firm_id == current_user.firm_id,
        Company.archived_at.is_(None),
    ]
    if visible is not None:
        conditions.append(Company.mandate_id.in_(visible))
    if mandate_id is not None:
        conditions.append(Company.mandate_id == mandate_id)

    companies = list(
        (await db.execute(select(Company).where(*conditions))).scalars().all()
    )
    items = await _enrich_companies_batch(db, companies)

    # Resolve mandate → project for grouping.
    mandate_ids = {c.mandate_id for c in companies}
    mandates = {
        m.id: m
        for m in (
            await db.execute(select(Mandate).where(Mandate.id.in_(mandate_ids)))
        ).scalars().all()
    } if mandate_ids else {}
    project_ids = {m.project_id for m in mandates.values() if m.project_id}
    projects = {
        p.id: p
        for p in (
            await db.execute(select(Project).where(Project.id.in_(project_ids)))
        ).scalars().all()
    } if project_ids else {}

    groups: dict[int, dict] = {}
    unassigned_key = -1
    for item in items:
        mand = mandates.get(item["mandate_id"])
        pid = mand.project_id if mand and mand.project_id else unassigned_key
        proj = projects.get(pid) if pid != unassigned_key else None
        g = groups.setdefault(
            pid,
            {
                "project_id": None if pid == unassigned_key else pid,
                "project_name": proj.name if proj else (mand.client_name if mand else "Ungrouped"),
                "client_name": proj.client_name if proj else (mand.client_name if mand else None),
                "companies": [],
            },
        )
        g["companies"].append(item)

    for g in groups.values():
        g["companies"].sort(key=_attention_rank)

    ordered = sorted(groups.values(), key=lambda g: (g["project_name"] or "").lower())
    return {"groups": ordered, "total": len(items)}
