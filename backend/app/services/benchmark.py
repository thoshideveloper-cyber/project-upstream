"""Mandate benchmark service — §5.4 mandate comparison for a specific company.

A2 decision: benchmark metrics are scoped to the CURRENT cycle for each company.
Events from archived/exhausted earlier cycles are excluded so that a restarted
company's touch count reflects only the active engagement, not the dead one.
Peer companies are filtered the same way for a like-for-like comparison.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.enums import CompanyStatus, OutreachEventType
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule


async def get_benchmark(db: AsyncSession, company_id: int, firm_id: int) -> dict:
    """Return §5.4 mandate benchmark stats for the given company."""
    company_result = await db.execute(
        select(Company).where(Company.id == company_id, Company.firm_id == firm_id)
    )
    company = company_result.scalar_one_or_none()
    if company is None:
        return {}

    # All non-archived companies in the same mandate
    peers_result = await db.execute(
        select(Company).where(
            Company.mandate_id == company.mandate_id,
            Company.archived_at.is_(None),
        )
    )
    peers = peers_result.scalars().all()
    peer_ids = [p.id for p in peers]
    total_peers = len(peer_ids)

    responded_peers = [p for p in peers if p.status == CompanyStatus.RESPONDED]
    mandate_response_rate = round(len(responded_peers) / total_peers, 4) if total_peers else 0.0

    if not peer_ids:
        return {
            "mandate_response_rate": 0.0,
            "mandate_avg_touches_to_response": None,
            "mandate_avg_days_to_response": None,
            "this_company_touches": 0,
            "this_company_days_to_response": None,
        }

    # A2: fetch current-cycle schedule_id for each peer, then scope events to that cycle.
    # This ensures a restarted company's old-cycle touches don't inflate its count.
    current_sched_result = await db.execute(
        select(OutreachSchedule.company_id, OutreachSchedule.id).where(
            OutreachSchedule.company_id.in_(peer_ids),
            OutreachSchedule.is_current.is_(True),
        )
    )
    current_sched_by_company: dict[int, int] = {
        row.company_id: row.id for row in current_sched_result.all()
    }
    current_sched_ids = list(current_sched_by_company.values())

    # Fetch events only for current-cycle schedules
    if not current_sched_ids:
        events_by_company: dict[int, list[OutreachEvent]] = {}
    else:
        events_result = await db.execute(
            select(OutreachEvent).where(OutreachEvent.schedule_id.in_(current_sched_ids))
        )
        all_events = events_result.scalars().all()
        events_by_company = {}
        for e in all_events:
            events_by_company.setdefault(e.company_id, []).append(e)

    # mandate_avg_touches_to_response and mandate_avg_days_to_response
    touches_list: list[int] = []
    days_list: list[int] = []
    for peer in responded_peers:
        evs = sorted(events_by_company.get(peer.id, []), key=lambda e: e.occurred_on)
        touches_list.append(len(evs))
        initial = next(
            (e.occurred_on for e in evs if e.event_type == OutreachEventType.INITIAL_EMAIL),
            None,
        )
        response = next(
            (e.occurred_on for e in evs if e.event_type == OutreachEventType.RESPONSE),
            None,
        )
        if initial and response:
            days_list.append((response - initial).days)

    mandate_avg_touches = round(sum(touches_list) / len(touches_list), 2) if touches_list else None
    mandate_avg_days = round(sum(days_list) / len(days_list), 2) if days_list else None

    # This company — current cycle only
    my_events = sorted(events_by_company.get(company_id, []), key=lambda e: e.occurred_on)
    this_touches = len(my_events)
    my_initial = next(
        (e.occurred_on for e in my_events if e.event_type == OutreachEventType.INITIAL_EMAIL),
        None,
    )
    my_response = next(
        (e.occurred_on for e in my_events if e.event_type == OutreachEventType.RESPONSE),
        None,
    )
    this_days = (my_response - my_initial).days if my_initial and my_response else None

    return {
        "mandate_response_rate": mandate_response_rate,
        "mandate_avg_touches_to_response": mandate_avg_touches,
        "mandate_avg_days_to_response": mandate_avg_days,
        "this_company_touches": this_touches,
        "this_company_days_to_response": this_days,
    }
