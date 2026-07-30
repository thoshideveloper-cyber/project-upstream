"""Schedule work-queue routes — the analyst's daily driver (E-05, E-07, §6.3)."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.core.time import today_ist
from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import OutreachEventType, ScheduleStatus, StoppedReason, UserRole
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.services.cadence import compute_cadence, get_followups_done
from app.schemas.outreach_schedule import OutreachScheduleRead

router = APIRouter(prefix="/schedule", tags=["schedule"])


async def _enrich_row(db, sched: OutreachSchedule, company: Company) -> dict:
    """Build a work-queue row: company summary + schedule + cadence computed fields."""
    fu = await get_followups_done(db, sched.id)
    cadence = compute_cadence(sched, fu)
    return {
        "company_id": company.id,
        "company_name": company.company_name,
        "mandate_id": company.mandate_id,
        "company_status": company.status,
        "schedule_id": sched.id,
        "cadence_interval_days": sched.cadence_interval_days,
        "regarding": sched.regarding,
        **cadence,
    }


async def _last_event_date(db, company_id: int) -> str | None:
    result = await db.execute(
        select(OutreachEvent.occurred_on)
        .where(OutreachEvent.company_id == company_id)
        .order_by(OutreachEvent.occurred_on.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row.isoformat() if row else None


async def _followups_map(db, schedule_ids: list[int]) -> dict[int, int]:
    """Batch FOLLOW_UP counts for many schedules in one query (avoids N+1)."""
    if not schedule_ids:
        return {}
    rows = (
        await db.execute(
            select(OutreachEvent.schedule_id, func.count())
            .where(
                OutreachEvent.schedule_id.in_(schedule_ids),
                OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
            )
            .group_by(OutreachEvent.schedule_id)
        )
    ).all()
    return {sid: n for sid, n in rows}


async def _primary_contact_map(db, company_ids: list[int]) -> dict[int, dict]:
    """Batch the primary contact per company (≤1 by invariant) — who the email goes to."""
    if not company_ids:
        return {}
    rows = (
        await db.execute(
            select(Contact).where(
                Contact.company_id.in_(company_ids),
                Contact.is_primary.is_(True),
                Contact.archived_at.is_(None),
            )
        )
    ).scalars().all()
    return {
        c.company_id: {
            "id": c.id,
            "name": c.contact_person,
            "designation": c.designation,
            "email": c.email,
        }
        for c in rows
    }


async def _last_event_map(db, company_ids: list[int]) -> dict[int, str]:
    """Batch the latest event date per company in one query (avoids N+1)."""
    if not company_ids:
        return {}
    rows = (
        await db.execute(
            select(OutreachEvent.company_id, func.max(OutreachEvent.occurred_on))
            .where(OutreachEvent.company_id.in_(company_ids))
            .group_by(OutreachEvent.company_id)
        )
    ).all()
    return {cid: d.isoformat() for cid, d in rows if d}


@router.get("/needs-initial")
async def needs_initial(
    db: SessionDep,
    current_user: CurrentUser,
    mandate_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Companies whose outreach schedule is AWAITING_INITIAL (E-07)."""
    visible = await visible_mandate_ids(current_user, db)

    stmt = (
        select(OutreachSchedule, Company)
        .join(Company, Company.id == OutreachSchedule.company_id)
        .where(
            OutreachSchedule.status == ScheduleStatus.AWAITING_INITIAL,
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
        .order_by(Company.company_name)
    )
    if visible is not None:
        stmt = stmt.where(Company.mandate_id.in_(visible))
    if mandate_id:
        stmt = stmt.where(Company.mandate_id == mandate_id)
    if q:
        stmt = stmt.where(Company.company_name.ilike(f"%{q}%"))

    rows = (await db.execute(stmt)).all()
    total = len(rows)
    if limit is not None:
        rows = rows[offset : offset + limit]

    fu_map = await _followups_map(db, [s.id for s, _ in rows])
    last_map = await _last_event_map(db, [c.id for _, c in rows])
    pc_map = await _primary_contact_map(db, [c.id for _, c in rows])
    items = []
    for sched, company in rows:
        cadence = compute_cadence(sched, fu_map.get(sched.id, 0))
        items.append({
            "company_id": company.id,
            "company_name": company.company_name,
            "mandate_id": company.mandate_id,
            "company_status": company.status,
            "schedule_id": sched.id,
            "cadence_interval_days": sched.cadence_interval_days,
            "regarding": sched.regarding,
            **cadence,
            "last_event_date": last_map.get(company.id),
            "primary_contact": pc_map.get(company.id),
        })

    return {"items": items, "total": total}


@router.get("/due")
async def due(
    db: SessionDep,
    current_user: CurrentUser,
    window: int = Query(default=7, ge=1, le=90),
    mandate_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    band: str | None = Query(default=None),
    day_offset: int | None = Query(default=None, ge=0, le=90),
    sort: str = Query(default="urgency"),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Active schedules due within the window — the analyst's work queue (E-07).

    Scales via batched cadence inputs (no N+1) + opt-in pagination (pass ``limit``).
    Always returns band ``counts`` and per-day ``by_day`` buckets so the header and
    week planner stay correct regardless of the current page or filters. Cadence
    itself is still computed by ``compute_cadence`` — the single source of truth.
    """
    visible = await visible_mandate_ids(current_user, db)

    stmt = (
        select(OutreachSchedule, Company)
        .join(Company, Company.id == OutreachSchedule.company_id)
        .where(
            OutreachSchedule.status == ScheduleStatus.ACTIVE,
            OutreachSchedule.initial_date.is_not(None),
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
    )
    if visible is not None:
        stmt = stmt.where(Company.mandate_id.in_(visible))
    if mandate_id:
        stmt = stmt.where(Company.mandate_id == mandate_id)
    if q:
        stmt = stmt.where(Company.company_name.ilike(f"%{q}%"))

    rows = (await db.execute(stmt)).all()
    fu_map = await _followups_map(db, [s.id for s, _ in rows])
    last_map = await _last_event_map(db, [c.id for _, c in rows])
    pc_map = await _primary_contact_map(db, [c.id for _, c in rows])

    # Compute cadence for every candidate once; keep those inside the window.
    in_window: list[tuple[int, dict]] = []
    for sched, company in rows:
        cadence = compute_cadence(sched, fu_map.get(sched.id, 0))
        dr = cadence["days_remaining"]
        if dr is None or dr > window:
            continue
        in_window.append((dr, {
            "company_id": company.id,
            "company_name": company.company_name,
            "mandate_id": company.mandate_id,
            "company_status": company.status,
            "schedule_id": sched.id,
            "cadence_interval_days": sched.cadence_interval_days,
            "regarding": sched.regarding,
            **cadence,
            "last_event_date": last_map.get(company.id),
            "primary_contact": pc_map.get(company.id),
        }))

    # Band counts + per-day buckets reflect the true situation (ignore overdue_only
    # and pagination so the header/planner never lie).
    counts = {
        "overdue": sum(1 for dr, _ in in_window if dr < 0),
        "due_today": sum(1 for dr, _ in in_window if dr == 0),
        "upcoming": sum(1 for dr, _ in in_window if dr > 0),
    }
    by_day = [
        {"offset": o, "count": sum(1 for dr, _ in in_window if dr == o)}
        for o in range(0, window + 1)
    ]

    def in_band(dr: int) -> bool:
        if band == "overdue":
            return dr < 0
        if band == "today":
            return dr == 0
        if band == "upcoming":
            return dr > 0
        return True  # "all" / unset

    selected = [
        t
        for t in in_window
        if in_band(t[0])
        and not (day_offset is not None and t[0] != day_offset)
    ]
    if sort == "name":
        selected.sort(key=lambda t: t[1]["company_name"].lower())
    elif sort == "deal":
        selected.sort(key=lambda t: (t[1]["mandate_id"], t[1]["company_name"].lower()))
    else:  # "urgency" — most overdue first
        selected.sort(key=lambda t: t[0])

    total = len(selected)
    if limit is not None:
        selected = selected[offset : offset + limit]

    return {
        "items": [row for _, row in selected],
        "total": total,
        "counts": counts,
        "by_day": by_day,
    }


@router.get("/overdue")
async def overdue(db: SessionDep, current_user: CurrentUser):
    """All overdue schedules — partner escalation view (E-05)."""
    visible = await visible_mandate_ids(current_user, db)

    q = (
        select(OutreachSchedule, Company)
        .join(Company, Company.id == OutreachSchedule.company_id)
        .where(
            OutreachSchedule.status == ScheduleStatus.ACTIVE,
            OutreachSchedule.initial_date.is_not(None),
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
    )
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))

    rows = (await db.execute(q)).all()
    today = today_ist()
    items = []
    for sched, company in rows:
        fu = await get_followups_done(db, sched.id)
        cadence = compute_cadence(sched, fu)
        if not cadence.get("is_overdue"):
            continue
        items.append({
            "company_id": company.id,
            "company_name": company.company_name,
            "mandate_id": company.mandate_id,
            "company_status": company.status,
            "schedule_id": sched.id,
            **cadence,
            "last_event_date": await _last_event_date(db, company.id),
        })

    items.sort(key=lambda r: r["days_remaining"] or 0)
    return {"items": items, "total": len(items)}


@router.get("/cold")
async def cold_queue(db: SessionDep, current_user: CurrentUser):
    """Companies whose current cycle is STOPPED/EXHAUSTED (the 'cold' work queue)."""
    visible = await visible_mandate_ids(current_user, db)

    q = (
        select(OutreachSchedule, Company)
        .join(Company, Company.id == OutreachSchedule.company_id)
        .where(
            OutreachSchedule.status == ScheduleStatus.STOPPED,
            OutreachSchedule.stopped_reason == StoppedReason.EXHAUSTED,
            OutreachSchedule.is_current.is_(True),
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
    )
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))

    rows = (await db.execute(q)).all()
    items = []
    for sched, company in rows:
        fu = await get_followups_done(db, sched.id)
        cadence = compute_cadence(sched, fu)
        items.append({
            "company_id": company.id,
            "company_name": company.company_name,
            "mandate_id": company.mandate_id,
            "company_status": company.status,
            "schedule_id": sched.id,
            "cycle_number": sched.cycle_number,
            "contact_id": sched.contact_id,
            "regarding": sched.regarding,
            **cadence,
            "last_event_date": await _last_event_date(db, company.id),
        })

    return {"items": items, "total": len(items)}


@router.get("/stats")
async def schedule_stats(db: SessionDep, current_user: CurrentUser):
    """Email stats panel: sent/responses this week, response rate, overdue count."""
    visible = await visible_mandate_ids(current_user, db)
    today = today_ist()

    # Week boundaries (Mon–Sun IST). Use date arithmetic, not .replace(day=…),
    # which breaks near month boundaries (e.g. the 1st of a month on a Wed).
    from datetime import timedelta
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    # Base event query for this firm (+ visibility scope)
    event_base = (
        select(OutreachEvent)
        .join(Company, Company.id == OutreachEvent.company_id)
        .where(
            OutreachEvent.firm_id == current_user.firm_id,
        )
    )
    if visible is not None:
        event_base = event_base.where(Company.mandate_id.in_(visible))

    # Sent this week = INITIAL_EMAIL + FOLLOW_UP this week
    sent_q = event_base.where(
        OutreachEvent.event_type.in_([
            OutreachEventType.INITIAL_EMAIL,
            OutreachEventType.FOLLOW_UP,
        ]),
        OutreachEvent.occurred_on >= week_start,
        OutreachEvent.occurred_on <= week_end,
    )
    sent_count_q = select(func.count()).select_from(sent_q.subquery())
    sent_this_week = (await db.execute(sent_count_q)).scalar() or 0

    # Responses this week
    resp_q = event_base.where(
        OutreachEvent.event_type == OutreachEventType.RESPONSE,
        OutreachEvent.occurred_on >= week_start,
        OutreachEvent.occurred_on <= week_end,
    )
    resp_count_q = select(func.count()).select_from(resp_q.subquery())
    responses_this_week = (await db.execute(resp_count_q)).scalar() or 0

    # Overall response rate (responded companies / total visible non-archived)
    company_base = select(Company).where(
        Company.firm_id == current_user.firm_id,
        Company.archived_at.is_(None),
    )
    if visible is not None:
        company_base = company_base.where(Company.mandate_id.in_(visible))

    total_q = select(func.count()).select_from(company_base.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    from app.models.enums import CompanyStatus
    resp_co_q = select(func.count()).select_from(
        company_base.where(Company.status == CompanyStatus.RESPONDED).subquery()
    )
    responded = (await db.execute(resp_co_q)).scalar() or 0
    response_rate = round(responded / total, 4) if total else 0.0

    # Overdue count
    sched_q = (
        select(OutreachSchedule, Company)
        .join(Company, Company.id == OutreachSchedule.company_id)
        .where(
            OutreachSchedule.status == ScheduleStatus.ACTIVE,
            OutreachSchedule.initial_date.is_not(None),
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
    )
    if visible is not None:
        sched_q = sched_q.where(Company.mandate_id.in_(visible))

    overdue_count = 0
    for sched, company in (await db.execute(sched_q)).all():
        fu = await get_followups_done(db, sched.id)
        cadence = compute_cadence(sched, fu)
        if cadence.get("is_overdue"):
            overdue_count += 1

    return {
        "sent_this_week": sent_this_week,
        "responses_this_week": responses_this_week,
        "response_rate": response_rate,
        "overdue_count": overdue_count,
    }
