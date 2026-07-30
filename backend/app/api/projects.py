"""Projects router — groups mandates under a single client engagement (Slice 3).

The list and detail endpoints share one batched rollup (`_mandate_rollups`) that
computes per-engagement health — companies, responded, overdue, cold, needs-initial,
last activity, team — in a fixed number of queries regardless of mandate count.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, PartnerDep, SessionDep, visible_mandate_ids
from app.models.company import Company
from app.models.enums import (
    CompanyStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    StoppedReason,
    UserRole,
)
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.cadence import compute_cadence

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _visible_project_ids(current_user: Any, db: Any) -> list[int] | None:
    """Return project IDs the user may see.

    Partners → None (all projects).
    Analysts → projects that contain at least one of their assigned mandates, PLUS
    projects they created (so a fresh, empty project is visible to its own creator
    before any engagement is added).
    """
    if current_user.role == UserRole.PARTNER:
        return None

    ids: set[int] = set()

    # Projects created by this analyst (visible even with no engagements yet).
    owned = await db.execute(
        select(Project.id).where(
            Project.firm_id == current_user.firm_id,
            Project.created_by_id == current_user.id,
        )
    )
    ids.update(row[0] for row in owned.all())

    # Projects that contain one of the analyst's assigned mandates.
    visible = await visible_mandate_ids(current_user, db)
    if visible:
        result = await db.execute(
            select(Mandate.project_id)
            .where(
                Mandate.id.in_(visible),
                Mandate.project_id.is_not(None),
                Mandate.archived_at.is_(None),
            )
            .distinct()
        )
        ids.update(row[0] for row in result.all())

    return list(ids)


def _empty_rollup() -> dict:
    return {
        "total_companies": 0,
        "responded": 0,
        "response_rate": 0.0,
        "overdue_count": 0,
        "cold_count": 0,
        "needs_initial_count": 0,
        "last_activity": None,
        "analysts": [],
    }


async def _mandate_rollups(db: Any, mandate_ids: list[int]) -> dict[int, dict]:
    """Per-mandate health stats, batched (5 queries total for any N mandates)."""
    rollups: dict[int, dict] = {mid: _empty_rollup() for mid in mandate_ids}
    if not mandate_ids:
        return rollups

    # 1) Companies → totals + responded, and the company→mandate map.
    co_rows = (
        await db.execute(
            select(Company.id, Company.mandate_id, Company.status).where(
                Company.mandate_id.in_(mandate_ids),
                Company.archived_at.is_(None),
            )
        )
    ).all()
    company_to_mandate: dict[int, int] = {}
    for cid, mid, status_val in co_rows:
        company_to_mandate[cid] = mid
        r = rollups[mid]
        r["total_companies"] += 1
        if status_val == CompanyStatus.RESPONDED:
            r["responded"] += 1

    company_ids = list(company_to_mandate)

    # 2) Current schedules → needs-initial / cold / overdue (via compute_cadence).
    scheds = []
    if company_ids:
        scheds = (
            (
                await db.execute(
                    select(OutreachSchedule).where(
                        OutreachSchedule.company_id.in_(company_ids),
                        OutreachSchedule.is_current.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

    # 3) FOLLOW_UP counts per schedule in one grouped query (no N+1).
    fu_map: dict[int, int] = {}
    sched_ids = [s.id for s in scheds]
    if sched_ids:
        fu_rows = (
            await db.execute(
                select(OutreachEvent.schedule_id, func.count())
                .where(
                    OutreachEvent.schedule_id.in_(sched_ids),
                    OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
                )
                .group_by(OutreachEvent.schedule_id)
            )
        ).all()
        fu_map = {sid: n for sid, n in fu_rows}

    for sched in scheds:
        mid = company_to_mandate.get(sched.company_id)
        if mid is None:
            continue
        r = rollups[mid]
        if sched.status == ScheduleStatus.AWAITING_INITIAL:
            r["needs_initial_count"] += 1
        elif (
            sched.status == ScheduleStatus.STOPPED
            and sched.stopped_reason == StoppedReason.EXHAUSTED
        ):
            r["cold_count"] += 1
        elif sched.status == ScheduleStatus.ACTIVE:
            cadence = compute_cadence(sched, fu_map.get(sched.id, 0))
            if cadence["is_overdue"]:
                r["overdue_count"] += 1

    # 4) Most recent outreach event per mandate → last_activity.
    if company_ids:
        la_rows = (
            await db.execute(
                select(Company.mandate_id, func.max(OutreachEvent.occurred_on))
                .join(Company, Company.id == OutreachEvent.company_id)
                .where(Company.mandate_id.in_(mandate_ids))
                .group_by(Company.mandate_id)
            )
        ).all()
        for mid, last in la_rows:
            if mid in rollups and last is not None:
                rollups[mid]["last_activity"] = last.isoformat()

    # 5) Assigned analysts per mandate → who works this book.
    an_rows = (
        await db.execute(
            select(MandateAssignment.mandate_id, User.id, User.full_name)
            .join(User, User.id == MandateAssignment.user_id)
            .where(MandateAssignment.mandate_id.in_(mandate_ids))
            .order_by(User.full_name)
        )
    ).all()
    for mid, uid, full_name in an_rows:
        rollups[mid]["analysts"].append({"id": uid, "full_name": full_name})

    for r in rollups.values():
        total = r["total_companies"]
        r["response_rate"] = round(r["responded"] / total, 4) if total else 0.0
    return rollups


async def _get_project(project_id: int, db: Any, current_user: Any) -> Project:
    visible = await _visible_project_ids(current_user, db)
    q = select(Project).where(
        Project.id == project_id,
        Project.firm_id == current_user.firm_id,
    )
    if visible is not None:
        q = q.where(Project.id.in_(visible))
    result = await db.execute(q)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("")
async def list_projects(
    db: SessionDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    """List projects visible to the current user, with per-project health rollups."""
    visible = await _visible_project_ids(current_user, db)

    base_q = select(Project).where(Project.firm_id == current_user.firm_id)
    if visible is not None:
        base_q = base_q.where(Project.id.in_(visible))
    if not include_archived:
        base_q = base_q.where(Project.archived_at.is_(None))
    if q:
        base_q = base_q.where(
            Project.name.ilike(f"%{q}%") | Project.client_name.ilike(f"%{q}%")
        )

    total_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = total_result.scalar() or 0

    paged = await db.execute(
        base_q.order_by(Project.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    projects = paged.scalars().all()
    project_ids = [p.id for p in projects]

    # All mandates the user may see, across the whole page, in one query.
    visible_m = await visible_mandate_ids(current_user, db)
    mandates: list[Mandate] = []
    if project_ids:
        mq = select(Mandate).where(
            Mandate.project_id.in_(project_ids),
            Mandate.archived_at.is_(None),
        )
        if visible_m is not None:
            mq = mq.where(Mandate.id.in_(visible_m))
        mandates = (await db.execute(mq)).scalars().all()

    rollups = await _mandate_rollups(db, [m.id for m in mandates])
    by_project: dict[int, list[Mandate]] = {pid: [] for pid in project_ids}
    for m in mandates:
        by_project[m.project_id].append(m)

    items = []
    for project in projects:
        ms = by_project.get(project.id, [])
        sides: dict[str, dict] = {
            t.value: {"engagements": 0, "companies": 0} for t in MandateType
        }
        agg = _empty_rollup()
        team: dict[int, str] = {}
        for m in ms:
            r = rollups.get(m.id, _empty_rollup())
            sides[m.type.value]["engagements"] += 1
            sides[m.type.value]["companies"] += r["total_companies"]
            agg["total_companies"] += r["total_companies"]
            agg["responded"] += r["responded"]
            agg["overdue_count"] += r["overdue_count"]
            agg["cold_count"] += r["cold_count"]
            agg["needs_initial_count"] += r["needs_initial_count"]
            if r["last_activity"] and (
                agg["last_activity"] is None or r["last_activity"] > agg["last_activity"]
            ):
                agg["last_activity"] = r["last_activity"]
            for a in r["analysts"]:
                team[a["id"]] = a["full_name"]

        data = ProjectRead.model_validate(project).model_dump()
        data["mandate_count"] = len(ms)
        data["sides"] = sides
        data["total_companies"] = agg["total_companies"]
        data["responded"] = agg["responded"]
        data["response_rate"] = (
            round(agg["responded"] / agg["total_companies"], 4)
            if agg["total_companies"]
            else 0.0
        )
        data["overdue_count"] = agg["overdue_count"]
        data["cold_count"] = agg["cold_count"]
        data["needs_initial_count"] = agg["needs_initial_count"]
        data["last_activity"] = agg["last_activity"]
        data["team"] = sorted(team.values())
        items.append(data)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Create a new project. Analysts may open their own client projects."""
    project = Project(
        firm_id=current_user.firm_id,
        created_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectRead.model_validate(project).model_dump()


@router.get("/{project_id}")
async def get_project(project_id: int, db: SessionDep, current_user: CurrentUser):
    """Project detail — mandates grouped by type with health stats per engagement."""
    project = await _get_project(project_id, db, current_user)

    # Load all non-archived mandates in this project
    mandate_result = await db.execute(
        select(Mandate).where(
            Mandate.project_id == project_id,
            Mandate.archived_at.is_(None),
        ).order_by(Mandate.name)
    )
    mandates = mandate_result.scalars().all()

    # Apply analyst visibility filter
    visible = await visible_mandate_ids(current_user, db)
    shown = [m for m in mandates if visible is None or m.id in visible]
    rollups = await _mandate_rollups(db, [m.id for m in shown])

    engagements: dict[str, list[dict]] = {
        MandateType.SELL_SIDE.value: [],
        MandateType.BUY_SIDE.value: [],
        MandateType.CAPITAL_RAISE.value: [],
    }

    for m in shown:
        r = rollups.get(m.id, _empty_rollup())
        engagements[m.type.value].append({
            "id": m.id,
            "name": m.name,
            "type": m.type.value,
            "status": m.status.value,
            "client_name": m.client_name,
            "total_companies": r["total_companies"],
            "responded": r["responded"],
            "response_rate": r["response_rate"],
            "overdue_count": r["overdue_count"],
            "cold_count": r["cold_count"],
            "needs_initial_count": r["needs_initial_count"],
            "last_activity": r["last_activity"],
            "analysts": r["analysts"],
        })

    # Headline: aggregate across all visible mandates in this project
    total_companies = 0
    total_responded = 0
    total_overdue = 0
    total_cold = 0
    total_needs_initial = 0
    last_activity: str | None = None
    for m_engagement in (engagements[t] for t in engagements):
        for m_data in m_engagement:
            total_companies += m_data["total_companies"]
            total_responded += m_data["responded"]
            total_overdue += m_data["overdue_count"]
            total_cold += m_data["cold_count"]
            total_needs_initial += m_data["needs_initial_count"]
            la = m_data["last_activity"]
            if la and (last_activity is None or la > last_activity):
                last_activity = la

    headline = {
        "total_companies": total_companies,
        "responded": total_responded,
        "response_rate": round(total_responded / total_companies, 4) if total_companies else 0.0,
        "overdue_count": total_overdue,
        "cold_count": total_cold,
        "needs_initial_count": total_needs_initial,
        "last_activity": last_activity,
    }

    data = ProjectRead.model_validate(project).model_dump()
    data["engagements"] = engagements
    data["headline"] = headline
    return data


@router.patch("/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: SessionDep,
    current_user: PartnerDep,
):
    """Update project name/client_name (partner only)."""
    project = await _get_project(project_id, db, current_user)
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(project, field, val)
    await db.commit()
    await db.refresh(project)
    return ProjectRead.model_validate(project).model_dump()


@router.delete("/{project_id}", status_code=http_status.HTTP_200_OK)
async def archive_project(
    project_id: int,
    db: SessionDep,
    current_user: PartnerDep,
):
    """Soft-delete a project (partner only)."""
    project = await _get_project(project_id, db, current_user)
    project.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Project archived"}


@router.post("/{project_id}/unarchive", status_code=http_status.HTTP_200_OK)
async def unarchive_project(
    project_id: int,
    db: SessionDep,
    current_user: PartnerDep,
):
    """Restore a soft-deleted project (partner only)."""
    # Bypass the normal visibility check — include archived
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.firm_id == current_user.firm_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.archived_at = None
    await db.commit()
    await db.refresh(project)
    return ProjectRead.model_validate(project).model_dump()
