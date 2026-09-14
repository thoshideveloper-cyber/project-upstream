"""Projects router — groups mandates under a single client engagement (Slice 3).

The list and detail endpoints share one batched rollup (`_mandate_rollups`) that
computes per-engagement health — companies, responded, overdue, cold, needs-initial,
last activity, team — in a fixed number of queries regardless of mandate count.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from fastapi import status as http_status
from sqlalchemy import func, select

from app.core.deps import (
    CurrentUser,
    PartnerDep,
    SessionDep,
    visible_mandate_ids,
    visible_project_ids,
)
from app.models.company import Company
from app.models.enums import (
    ActivityObjectType,
    ActivityVerb,
    CompanyStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    StoppedReason,
)
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import (
    activity,
    analytics as analytics_service,
    project_delete,
    tasks as task_service,
)
from app.services.cadence import compute_cadence

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Helpers ───────────────────────────────────────────────────────────────────


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


async def _members_for_page(db: Any, projects: list[Project]) -> dict[int, list[dict]]:
    """Members for every project on the page in two queries, never two per project.

    ``GET /projects`` promises a fixed query count regardless of how many projects it
    returns (see this module's docstring), so this must not become a loop over
    ``_members``.
    """
    project_ids = [p.id for p in projects]
    out: dict[int, list[dict]] = {pid: [] for pid in project_ids}
    if not project_ids:
        return out

    seen: dict[int, set[int]] = {pid: set() for pid in project_ids}

    def _add(pid: int, uid: int, full_name: str, source: str) -> None:
        if uid in seen[pid]:
            return
        seen[pid].add(uid)
        out[pid].append({"id": uid, "full_name": full_name, "source": source})

    assigned = (
        await db.execute(
            select(ProjectAssignment.project_id, User.id, User.full_name)
            .join(User, User.id == ProjectAssignment.user_id)
            .where(ProjectAssignment.project_id.in_(project_ids))
            .order_by(User.full_name)
        )
    ).all()
    for pid, uid, full_name in assigned:
        _add(pid, uid, full_name, "assigned")

    via_mandate = (
        await db.execute(
            select(Mandate.project_id, User.id, User.full_name)
            .join(MandateAssignment, MandateAssignment.mandate_id == Mandate.id)
            .join(User, User.id == MandateAssignment.user_id)
            .where(
                Mandate.project_id.in_(project_ids),
                Mandate.archived_at.is_(None),
            )
            .order_by(User.full_name)
        )
    ).all()
    for pid, uid, full_name in via_mandate:
        _add(pid, uid, full_name, "mandate")

    creator_ids = {p.created_by_id for p in projects if p.created_by_id}
    if creator_ids:
        creators = {
            uid: name
            for uid, name in (
                await db.execute(
                    select(User.id, User.full_name).where(User.id.in_(list(creator_ids)))
                )
            ).all()
        }
        for project in projects:
            if project.created_by_id and project.created_by_id in creators:
                _add(
                    project.id,
                    project.created_by_id,
                    creators[project.created_by_id],
                    "creator",
                )

    for rows in out.values():
        rows.sort(key=lambda r: r["full_name"])
    return out


async def _get_project(project_id: int, db: Any, current_user: Any) -> Project:
    visible = await visible_project_ids(current_user, db)
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
    visible = await visible_project_ids(current_user, db)

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
    # Two grouped queries for the whole page, never two per project -- this router's
    # docstring advertises a fixed query count regardless of how many projects it returns.
    task_counts = await task_service.project_task_counts(
        db, current_user, visible, project_ids=project_ids
    )
    members_by_project = await _members_for_page(db, projects)
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
        counts = task_counts.get(project.id, {})
        data["open_task_count"] = counts.get("open", 0)
        data["overdue_task_count"] = counts.get("overdue", 0)
        # ``team`` (a list of names) stays exactly as it was — the frontend depends on
        # it. ``members`` is the richer form, added alongside rather than instead of.
        data["members"] = members_by_project.get(project.id, [])
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
    await db.flush()
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.PROJECT_CREATED,
        object_type=ActivityObjectType.PROJECT,
        object_id=project.id,
        object_label=project.name,
        project_id=project.id,
    )
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

    visible_projects = await visible_project_ids(current_user, db)
    by_status = await task_service.project_status_breakdown(
        db, current_user, visible_projects, project_id
    )
    counts = (
        await task_service.project_task_counts(
            db, current_user, visible_projects, project_ids=[project_id]
        )
    ).get(project_id, {})

    data = ProjectRead.model_validate(project).model_dump()
    data["engagements"] = engagements
    data["headline"] = headline
    data["tasks"] = {
        "open": counts.get("open", 0),
        "overdue": counts.get("overdue", 0),
        "by_status": by_status,
    }
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
    if updates:
        await activity.log(
            db,
            actor=current_user,
            verb=ActivityVerb.PROJECT_UPDATED,
            object_type=ActivityObjectType.PROJECT,
            object_id=project.id,
            object_label=project.name,
            project_id=project.id,
            meta={"fields": sorted(updates)},
        )
    await db.commit()
    await db.refresh(project)
    return ProjectRead.model_validate(project).model_dump()


@router.delete("/{project_id}", status_code=http_status.HTTP_200_OK)
async def archive_project(
    project_id: int,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Soft-delete a project. Visibility, not role.

    Un-gated on purpose, and it is the same decision as the one on permanent delete:
    archiving is also the first of the two steps that delete requires, so a partner-only
    archive would make an un-gated delete unreachable for the analyst it was un-gated for.
    Reversible in one click via /unarchive, which is what makes it safe to open up.
    """
    project = await _get_project(project_id, db, current_user)
    project.archived_at = datetime.now(timezone.utc)
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.PROJECT_ARCHIVED,
        object_type=ActivityObjectType.PROJECT,
        object_id=project.id,
        object_label=project.name,
        project_id=project.id,
    )
    await db.commit()
    return {"detail": "Project archived"}


@router.post("/{project_id}/unarchive", status_code=http_status.HTTP_200_OK)
async def unarchive_project(
    project_id: int,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Restore a soft-deleted project. Visibility, not role — the mirror of archive.

    Scoped through ``visible_project_ids(..., include_archived=True)`` rather than the
    plain firm check this used to do: an archived project's mandates are archived too, so
    the default helper would hide from an analyst the very project they just archived.
    """
    project = await _get_deletable_project(project_id, db, current_user)
    project.archived_at = None
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.PROJECT_UNARCHIVED,
        object_type=ActivityObjectType.PROJECT,
        object_id=project.id,
        object_label=project.name,
        project_id=project.id,
    )
    await db.commit()
    await db.refresh(project)
    return ProjectRead.model_validate(project).model_dump()


# ── Activity ──────────────────────────────────────────────────────────────────


@router.get("/{project_id}/activity")
async def project_activity(
    project_id: int,
    db: SessionDep,
    current_user: CurrentUser,
    verb: list[ActivityVerb] | None = Query(default=None),
    group: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    """This project's trail. ``_get_project`` first, so an invisible project 404s
    rather than returning a convincing empty feed."""
    await _get_project(project_id, db, current_user)
    visible = await visible_project_ids(current_user, db)
    verbs = list(verb) if verb else None
    if group:
        verbs = list(activity.VERB_GROUPS.get(group.upper(), ()))
        if not verbs:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
    return await activity.feed(
        db,
        user=current_user,
        visible_projects=visible,
        project_id=project_id,
        verbs=verbs,
        page=page,
        page_size=page_size,
    )


# ── Members ───────────────────────────────────────────────────────────────────
#
# The asymmetry with tasks is intentional. Any user may assign a task; only a partner may
# add a project member. Task assignment allocates work; project assignment grants access.


class AssignmentBody(BaseModel):
    user_id: int


async def _members(db: Any, project: Project) -> list[dict]:
    """The union of everyone on this project, each row tagged with how they got here.

    Returning only ``project_assignments`` would show every project an empty team on the
    day this ships, and the feature would look broken rather than new. The mandate-derived
    half is the team that has actually been working the book all along.
    """
    rows: dict[int, dict] = {}

    def _add(uid: int, full_name: str, email: str | None, source: str) -> None:
        existing = rows.get(uid)
        if existing is None:
            rows[uid] = {
                "id": uid,
                "full_name": full_name,
                "email": email,
                "source": source,
                "sources": [source],
            }
        elif source not in existing["sources"]:
            existing["sources"].append(source)

    if project.created_by_id:
        creator = (
            await db.execute(select(User).where(User.id == project.created_by_id))
        ).scalar_one_or_none()
        if creator:
            _add(creator.id, creator.full_name, creator.email, "creator")

    assigned = (
        await db.execute(
            select(User)
            .join(ProjectAssignment, ProjectAssignment.user_id == User.id)
            .where(ProjectAssignment.project_id == project.id)
            .order_by(User.full_name)
        )
    ).scalars().all()
    for u in assigned:
        _add(u.id, u.full_name, u.email, "assigned")

    via_mandate = (
        await db.execute(
            select(User)
            .join(MandateAssignment, MandateAssignment.user_id == User.id)
            .join(Mandate, Mandate.id == MandateAssignment.mandate_id)
            .where(Mandate.project_id == project.id, Mandate.archived_at.is_(None))
            .order_by(User.full_name)
        )
    ).scalars().all()
    for u in via_mandate:
        _add(u.id, u.full_name, u.email, "mandate")

    # "assigned" wins as the headline source: it is the one a partner granted directly
    # and the only one that can be revoked here.
    order = {"assigned": 0, "mandate": 1, "creator": 2}
    for row in rows.values():
        row["source"] = sorted(row["sources"], key=lambda s: order[s])[0]
    return sorted(rows.values(), key=lambda r: r["full_name"])


# ── Analytics ─────────────────────────────────────────────────────────────────


@router.get("/{project_id}/analytics")
async def project_analytics(
    project_id: int,
    db: SessionDep,
    current_user: CurrentUser,
    weeks: int = Query(default=12, ge=2, le=52),
):
    """This project's analytics — the firm-wide panels, narrowed to one book.

    Deliberately no new query layer: every figure here comes from the same
    ``services.analytics`` functions the firm-wide /analytics page uses, called with
    this project's mandate ids instead of the whole firm's. One definition of "replied"
    for the product, so a project page and the firm page can never disagree.

    Not partner-gated (unlike ``/analytics/projects``, which spans the firm): an analyst
    may read the analytics of a project they can already open, and ``visible_mandate_ids``
    narrows it to the engagements they are actually on.
    """
    await _get_project(project_id, db, current_user)

    mandate_rows = (
        await db.execute(
            select(Mandate.id).where(
                Mandate.project_id == project_id,
                Mandate.firm_id == current_user.firm_id,
                Mandate.archived_at.is_(None),
            )
        )
    ).all()
    mandate_ids = [r[0] for r in mandate_rows]

    visible = await visible_mandate_ids(current_user, db)
    if visible is not None:
        mandate_ids = [mid for mid in mandate_ids if mid in visible]

    # An empty list must mean "this project, which has nothing" — never `None`, which
    # every service function reads as "no filter, the whole firm".
    if not mandate_ids:
        return {
            "overview": await analytics_service.get_overview(db, current_user.firm_id, []),
            "timeseries": [],
            "by_engagement": [],
            "by_category": [],
            "by_layer": [],
            "reply_timing": await analytics_service.get_response_latency(
                db, current_user.firm_id, []
            ),
            "weeks": weeks,
        }

    firm_id = current_user.firm_id
    return {
        "overview": await analytics_service.get_overview(db, firm_id, mandate_ids),
        "timeseries": await analytics_service.get_timeseries(db, firm_id, mandate_ids, weeks),
        "by_engagement": await analytics_service.get_by_engagement(db, firm_id, mandate_ids),
        "by_category": await analytics_service.get_response_by_category(db, firm_id, mandate_ids),
        "by_layer": await analytics_service.get_response_by_sourcing_layer(
            db, firm_id, mandate_ids
        ),
        "reply_timing": await analytics_service.get_response_latency(db, firm_id, mandate_ids),
        "weeks": weeks,
    }


@router.get("/{project_id}/members")
async def list_members(project_id: int, db: SessionDep, current_user: CurrentUser):
    """Everyone on this project — assigned, via an engagement, or the creator."""
    project = await _get_project(project_id, db, current_user)
    return {"items": await _members(db, project)}


@router.post("/{project_id}/assignments", status_code=http_status.HTTP_201_CREATED)
async def assign_member(
    project_id: int, body: AssignmentBody, db: SessionDep, current_user: PartnerDep
):
    """Grant a user access to this project. Idempotent, mirroring the mandate route."""
    project = await _get_project(project_id, db, current_user)
    user = (
        await db.execute(
            select(User).where(
                User.id == body.user_id, User.firm_id == current_user.firm_id
            )
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        await db.execute(
            select(ProjectAssignment).where(
                ProjectAssignment.project_id == project_id,
                ProjectAssignment.user_id == body.user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"detail": "Already assigned"}

    db.add(ProjectAssignment(project_id=project_id, user_id=body.user_id))
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.PROJECT_MEMBER_ADDED,
        object_type=ActivityObjectType.PROJECT_ASSIGNMENT,
        object_id=project.id,
        object_label=project.name,
        project_id=project.id,
        meta={"user_id": user.id, "user_name": user.full_name},
    )
    await db.commit()
    return {"detail": "User assigned"}


@router.delete("/{project_id}/assignments/{user_id}")
async def unassign_member(
    project_id: int, user_id: int, db: SessionDep, current_user: PartnerDep
):
    project = await _get_project(project_id, db, current_user)
    assignment = (
        await db.execute(
            select(ProjectAssignment).where(
                ProjectAssignment.project_id == project_id,
                ProjectAssignment.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.PROJECT_MEMBER_REMOVED,
        object_type=ActivityObjectType.PROJECT_ASSIGNMENT,
        object_id=project.id,
        object_label=project.name,
        project_id=project.id,
        meta={"user_id": user_id},
    )
    await db.commit()
    return {"detail": "User unassigned"}


# ── Permanent delete ──────────────────────────────────────────────────────────
#
# POST, not DELETE. ``DELETE /projects/{id}`` already means *archive* and that convention
# is firm-wide, so a distinct path can never be reached by a typo.
# ``POST /workspace/reset`` is the precedent.


class PermanentDeleteBody(BaseModel):
    confirm_project_name: str


async def _get_deletable_project(project_id: int, db: Any, current_user: Any) -> Project:
    """Visibility, not role — and archived projects included.

    Necessary, not incidental: the default helper filters archived mandates out of its
    second union term, so an analyst whose only route into a project was via an archived
    engagement would 404 on their own project at exactly the moment rail 1 requires it to
    be archived.
    """
    visible = await visible_project_ids(current_user, db, include_archived=True)
    q = select(Project).where(
        Project.id == project_id, Project.firm_id == current_user.firm_id
    )
    if visible is not None:
        q = q.where(Project.id.in_(visible))
    project = (await db.execute(q)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/deletion-preview")
async def deletion_preview(project_id: int, db: SessionDep, current_user: CurrentUser):
    """Exactly what a permanent delete would remove. Read-only."""
    project = await _get_deletable_project(project_id, db, current_user)
    return await project_delete.preview_deletion(db, project)


@router.post("/{project_id}/permanent-delete", status_code=http_status.HTTP_200_OK)
async def permanent_delete(
    project_id: int,
    body: PermanentDeleteBody,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Destroy a project and its whole book. Irreversible.

    **No role gate, deliberately** — any user who can see the project may do this. The
    rails are the archived-first requirement, the name confirmation and the preview, not
    a role check. See ``services/project_delete.py`` for the full reasoning; do not
    "fix" this into a partner-only route without revisiting that decision.
    """
    project = await _get_deletable_project(project_id, db, current_user)

    if project.archived_at is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Archive this project before deleting it permanently. "
                "Deleting is a deliberate second step."
            ),
        )
    if body.confirm_project_name.strip() != project.name:
        raise HTTPException(
            status_code=422,
            detail=f"Type the project's name exactly ({project.name}) to confirm.",
        )

    project_name = project.name
    deleted = await project_delete.delete_project(db, project, actor=current_user)
    return {
        "deleted": True,
        "project": {"id": project_id, "name": project_name},
        "counts": deleted,
        "total": sum(deleted.values()),
    }
