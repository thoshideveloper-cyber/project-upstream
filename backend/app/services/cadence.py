"""Cadence service — schedule lifecycle + computed fields (plan.md §5.2).

Rules (locked, do not deviate):
- AWAITING_INITIAL: no initial_date; clock does not tick.
- ACTIVE: initial_date set on first INITIAL_EMAIL; fixed-anchor follow-ups.
- STOPPED: terminal (or MANUAL-paused, which can be resumed).
- initial_date is immutable once set.
- All date math uses today_ist() (Asia/Kolkata).
- COLD is a derived state: current cycle STOPPED with stopped_reason=EXHAUSTED.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.enums import (
    CompanyStatus,
    OutreachEventType,
    ScheduleStatus,
    StoppedReason,
)
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.firm import Firm
    from app.models.mandate import Mandate


async def get_followups_done(db: AsyncSession, schedule_id: int) -> int:
    """Count FOLLOW_UP events for this schedule."""
    result = await db.execute(
        select(func.count()).select_from(OutreachEvent).where(
            OutreachEvent.schedule_id == schedule_id,
            OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
        )
    )
    return result.scalar() or 0


def effective_cap(firm: "Firm", mandate: "Mandate") -> int:
    """Resolve the follow-up cap: mandate override ?? firm default ?? 4."""
    if mandate.follow_up_cap is not None:
        return mandate.follow_up_cap
    return firm.follow_up_cap if firm.follow_up_cap is not None else 4


def compute_cadence(sched: OutreachSchedule, followups_done: int) -> dict:
    """Return cadence computed fields for one schedule (§5.2).

    next_due_date = initial_date + (followups_done+1) * cadence_interval_days
    is_cold = True when STOPPED with stopped_reason=EXHAUSTED (cap reached).
    """
    is_cold = (
        sched.status == ScheduleStatus.STOPPED
        and sched.stopped_reason == StoppedReason.EXHAUSTED
    )
    if sched.status != ScheduleStatus.ACTIVE or sched.initial_date is None:
        return {
            "schedule_status": sched.status,
            "cycle_number": sched.cycle_number,
            "is_cold": is_cold,
            "initial_date": sched.initial_date,
            "next_due_date": None,
            "days_remaining": None,
            "is_overdue": False,
        }
    today = today_ist()
    n = followups_done + 1
    next_due: date = sched.initial_date + timedelta(days=n * sched.cadence_interval_days)
    days_remaining = (next_due - today).days
    return {
        "schedule_status": sched.status,
        "cycle_number": sched.cycle_number,
        "is_cold": is_cold,
        "initial_date": sched.initial_date,
        "next_due_date": next_due,
        "days_remaining": days_remaining,
        "is_overdue": days_remaining < 0,
    }


async def activate_schedule(
    db: AsyncSession, sched: OutreachSchedule, initial_date: date
) -> None:
    """Transition AWAITING_INITIAL → ACTIVE on the first INITIAL_EMAIL (E-01)."""
    if sched.initial_date is not None:
        return  # immutable — already activated; log the event but don't change the date
    sched.status = ScheduleStatus.ACTIVE
    sched.initial_date = initial_date


async def stop_schedule(
    db: AsyncSession,
    sched: OutreachSchedule,
    reason: StoppedReason,
) -> None:
    """Transition any active schedule → STOPPED."""
    sched.status = ScheduleStatus.STOPPED
    sched.stopped_reason = reason
    sched.stopped_at = datetime.now(timezone.utc)


async def pause_schedule(db: AsyncSession, sched: OutreachSchedule) -> None:
    """Manual pause (STOPPED + reason=MANUAL)."""
    await stop_schedule(db, sched, StoppedReason.MANUAL)


async def resume_schedule(db: AsyncSession, sched: OutreachSchedule) -> None:
    """Resume a manually-paused schedule → ACTIVE."""
    if sched.stopped_reason != StoppedReason.MANUAL:
        return  # only manual pauses are resumable
    if sched.initial_date is None:
        sched.status = ScheduleStatus.AWAITING_INITIAL
    else:
        sched.status = ScheduleStatus.ACTIVE
    sched.stopped_reason = None
    sched.stopped_at = None


# ── Status-to-StoppedReason mapping ──────────────────────────────────────────

_STATUS_TO_REASON: dict[CompanyStatus, StoppedReason] = {
    CompanyStatus.RESPONDED: StoppedReason.RESPONDED,
    CompanyStatus.BOUNCED: StoppedReason.BOUNCED,
    CompanyStatus.DECLINED: StoppedReason.DECLINED,
}

EVENT_STOP_MAP: dict[OutreachEventType, StoppedReason] = {
    OutreachEventType.RESPONSE: StoppedReason.RESPONDED,
    OutreachEventType.BOUNCE: StoppedReason.BOUNCED,
}

EVENT_STATUS_MAP: dict[OutreachEventType, CompanyStatus] = {
    OutreachEventType.RESPONSE: CompanyStatus.RESPONDED,
    OutreachEventType.BOUNCE: CompanyStatus.BOUNCED,
}

# Single-writer status projection (BUG-1). Maps a status-bearing event → the status
# it implies. NOTE is not status-bearing. COLD is NEVER written here — it is a derived
# cadence state (current cycle STOPPED/EXHAUSTED), read separately.
_EVENT_STATUS_RESULT: dict[OutreachEventType, CompanyStatus] = {
    OutreachEventType.RESPONSE: CompanyStatus.RESPONDED,
    OutreachEventType.BOUNCE: CompanyStatus.BOUNCED,
    OutreachEventType.INITIAL_EMAIL: CompanyStatus.CONTACTED,
    OutreachEventType.FOLLOW_UP: CompanyStatus.CONTACTED,
    OutreachEventType.CALL: CompanyStatus.CONTACTED,
    OutreachEventType.LINKEDIN: CompanyStatus.CONTACTED,
    OutreachEventType.MEETING: CompanyStatus.CONTACTED,
}

# Manually-set terminal statuses that recompute must not silently downgrade.
_MANUAL_TERMINAL = {CompanyStatus.DECLINED, CompanyStatus.INTERESTED}


async def recompute_status(db: AsyncSession, company: "Company") -> None:
    """Recompute a company's status cache from its event log — the ONLY status writer
    for event-driven changes (BUG-1). Derives NOT_CONTACTED/CONTACTED/RESPONDED/BOUNCED
    from the latest status-bearing event; preserves manual DECLINED/INTERESTED overrides
    unless a newer RESPONSE/BOUNCE supersedes them. Never writes COLD (derived).
    """
    rows = (
        await db.execute(
            select(OutreachEvent.event_type)
            .where(OutreachEvent.company_id == company.id)
            .order_by(OutreachEvent.occurred_on.desc(), OutreachEvent.id.desc())
        )
    ).all()
    computed = CompanyStatus.NOT_CONTACTED
    for (event_type,) in rows:
        if event_type in _EVENT_STATUS_RESULT:
            computed = _EVENT_STATUS_RESULT[event_type]
            break
    if computed in (CompanyStatus.RESPONDED, CompanyStatus.BOUNCED):
        company.status = computed
    elif company.status in _MANUAL_TERMINAL:
        return  # keep the manual terminal state
    else:
        company.status = computed


async def restart_cycle(
    db: AsyncSession,
    company: "Company",
    new_contact_id: int | None,
    owner_id: int,
) -> OutreachSchedule:
    """Start a new cadence cycle after the current one is STOPPED/EXHAUSTED.

    - Marks the current is_current cycle as is_current=False.
    - Creates a new OutreachSchedule row (cycle_number+1, AWAITING_INITIAL, is_current=True).
    - Logs a NOTE event recording the restart (append-only — never mutates past events).
    - Returns the new schedule row.
    """
    # Find and validate the current cycle
    result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company.id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    current = result.scalar_one_or_none()
    if current is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No current cycle found for this company")
    if current.status != ScheduleStatus.STOPPED:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Current cycle must be STOPPED to restart; status is {current.status.value}",
        )

    next_cycle_number = current.cycle_number + 1
    current.is_current = False

    new_sched = OutreachSchedule(
        firm_id=company.firm_id,
        company_id=company.id,
        cycle_number=next_cycle_number,
        is_current=True,
        status=ScheduleStatus.AWAITING_INITIAL,
        contact_id=new_contact_id,
        cadence_interval_days=current.cadence_interval_days,
        regarding=current.regarding,
    )
    db.add(new_sched)
    await db.flush()  # get new_sched.id

    # Append-only restart NOTE event
    note = OutreachEvent(
        firm_id=company.firm_id,
        company_id=company.id,
        schedule_id=new_sched.id,
        contact_id=new_contact_id,
        event_type=OutreachEventType.NOTE,
        occurred_on=today_ist(),
        notes=(
            f"Cycle {next_cycle_number} started"
            + (f" with contact #{new_contact_id}" if new_contact_id else "")
            + f" (previous cycle {current.cycle_number} was {current.stopped_reason.value if current.stopped_reason else 'STOPPED'})"
        ),
        owner_id=owner_id,
    )
    db.add(note)
    return new_sched
