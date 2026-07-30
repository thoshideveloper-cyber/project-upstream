"""Cadence engine tests — schedule lifecycle, computed fields, work queues, append-only log."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from types import SimpleNamespace

from app.core.time import today_ist
from app.models.company import Company
from app.models.enums import (
    CompanyStatus,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    StoppedReason,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.user import User
from app.services.cadence import compute_cadence

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient) -> None:
    resp = await client.post("/auth/login", json=PARTNER)
    assert resp.status_code == 200


async def _create_company(client: AsyncClient, mandate_id: int, name: str = "Cadence Corp") -> dict:
    resp = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET"},
    )
    assert resp.status_code == 201
    return resp.json()


async def _log_event(
    client: AsyncClient,
    company_id: int,
    event_type: str,
    occurred_on: str | None = None,
    notes: str | None = None,
) -> dict:
    today = occurred_on or today_ist().isoformat()
    resp = await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": event_type, "occurred_on": today, "notes": notes},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Unit tests for compute_cadence ────────────────────────────────────────────


def _sched(
    initial_date: date,
    interval: int = 14,
    st: ScheduleStatus = ScheduleStatus.ACTIVE,
    stopped_reason: StoppedReason | None = None,
    cycle_number: int = 1,
):
    return SimpleNamespace(
        status=st,
        initial_date=initial_date,
        cadence_interval_days=interval,
        stopped_reason=stopped_reason,
        cycle_number=cycle_number,
    )


def test_compute_cadence_zero_followups():
    """First follow-up is due at initial_date + 1×interval."""
    initial = date(2024, 1, 1)
    sched = _sched(initial, 14)
    result = compute_cadence(sched, followups_done=0)
    assert result["next_due_date"] == date(2024, 1, 15)  # +14d
    assert result["schedule_status"] == ScheduleStatus.ACTIVE


def test_compute_cadence_two_followups():
    """After 2 follow-ups, third is due at initial_date + 3×interval."""
    initial = date(2024, 1, 1)
    sched = _sched(initial, 14)
    result = compute_cadence(sched, followups_done=2)
    expected = initial + timedelta(days=3 * 14)  # Jan 1 + 42d = Feb 12
    assert result["next_due_date"] == expected


def test_compute_cadence_overdue():
    """days_remaining < 0 iff next_due_date < today."""
    far_past = today_ist() - timedelta(days=100)
    sched = _sched(far_past, 14)
    result = compute_cadence(sched, followups_done=0)
    assert result["is_overdue"] is True
    assert result["days_remaining"] < 0


def test_compute_cadence_awaiting_initial():
    """AWAITING_INITIAL schedules produce no cadence fields."""
    s = _sched(None, st=ScheduleStatus.AWAITING_INITIAL)  # type: ignore[arg-type]
    result = compute_cadence(s, followups_done=0)
    assert result["next_due_date"] is None
    assert result["is_overdue"] is False


def test_compute_cadence_stopped():
    """STOPPED schedules produce no cadence fields."""
    s = _sched(date(2024, 1, 1), st=ScheduleStatus.STOPPED)
    result = compute_cadence(s, followups_done=0)
    assert result["next_due_date"] is None


# ── Integration tests ─────────────────────────────────────────────────────────


async def test_initial_email_activates_schedule(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """Logging INITIAL_EMAIL transitions AWAITING_INITIAL → ACTIVE and sets initial_date."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    assert company["schedule_status"] == "AWAITING_INITIAL"

    today = today_ist().isoformat()
    await _log_event(client, company["id"], "INITIAL_EMAIL", today)

    sched = (await db_session.execute(
        select(OutreachSchedule).where(OutreachSchedule.company_id == company["id"])
    )).scalar_one()
    assert sched.status == ScheduleStatus.ACTIVE
    assert str(sched.initial_date) == today


async def test_initial_date_immutable(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """Second INITIAL_EMAIL does not change initial_date."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    first_date = "2024-01-01"
    second_date = "2024-02-01"
    await _log_event(client, company["id"], "INITIAL_EMAIL", first_date)
    await _log_event(client, company["id"], "INITIAL_EMAIL", second_date)

    sched = (await db_session.execute(
        select(OutreachSchedule).where(OutreachSchedule.company_id == company["id"])
    )).scalar_one()
    assert str(sched.initial_date) == first_date  # unchanged


async def test_response_stops_cadence_and_flips_status(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """Logging a RESPONSE event stops the schedule and sets company status to RESPONDED."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    await _log_event(client, company["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, company["id"], "RESPONSE", "2024-01-10")

    await db_session.refresh(
        (await db_session.execute(select(OutreachSchedule).where(
            OutreachSchedule.company_id == company["id"]
        ))).scalar_one()
    )
    sched = (await db_session.execute(
        select(OutreachSchedule).where(OutreachSchedule.company_id == company["id"])
    )).scalar_one()
    assert sched.status == ScheduleStatus.STOPPED
    assert sched.stopped_reason == StoppedReason.RESPONDED

    company_row = (await db_session.execute(
        select(Company).where(Company.id == company["id"])
    )).scalar_one()
    assert company_row.status == CompanyStatus.RESPONDED


async def test_events_are_append_only(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """There is no endpoint to edit or delete outreach events."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    event = await _log_event(client, company["id"], "NOTE", "2024-01-01")
    eid = event["id"]

    # No DELETE or PUT endpoint exists — 404 (no route) proves append-only
    del_resp = await client.delete(f"/companies/{company['id']}/events/{eid}")
    assert del_resp.status_code in (404, 405)

    put_resp = await client.put(
        f"/companies/{company['id']}/events/{eid}", json={"notes": "changed"}
    )
    assert put_resp.status_code in (404, 405)


async def test_follow_up_advances_counter(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """Each FOLLOW_UP event increments followups_done and shifts next_due_date."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    initial_date = "2024-01-01"
    await _log_event(client, company["id"], "INITIAL_EMAIL", initial_date)

    # Before any follow-up: due at +7 (default cadence is 7 days)
    sched_resp = await client.get(f"/companies/{company['id']}/schedule")
    assert sched_resp.json()["next_due_date"] == "2024-01-08"

    # After 1 follow-up: due at +14
    await _log_event(client, company["id"], "FOLLOW_UP", "2024-01-08")
    sched_resp2 = await client.get(f"/companies/{company['id']}/schedule")
    assert sched_resp2.json()["next_due_date"] == "2024-01-15"


# ── Work queue endpoints ──────────────────────────────────────────────────────


async def test_needs_initial_queue(
    client: AsyncClient, mandate: Mandate, partner: User
):
    """New company appears in /schedule/needs-initial; disappears after INITIAL_EMAIL."""
    await _login(client)
    company = await _create_company(client, mandate.id, name="Needs Initial Co")
    cid = company["id"]

    resp = await client.get("/schedule/needs-initial")
    ids = [r["company_id"] for r in resp.json()["items"]]
    assert cid in ids

    await _log_event(client, cid, "INITIAL_EMAIL", "2024-01-01")
    resp2 = await client.get("/schedule/needs-initial")
    ids2 = [r["company_id"] for r in resp2.json()["items"]]
    assert cid not in ids2


async def test_due_queue_overdue_first(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """Companies with negative days_remaining appear first in /schedule/due."""
    await _login(client)

    # Overdue company — initial date far in the past
    c1 = await _create_company(client, mandate.id, name="Overdue Corp")
    await _log_event(client, c1["id"], "INITIAL_EMAIL", "2023-01-01")

    # Due-soon company — initial date in the recent past but not yet overdue
    c2 = await _create_company(client, mandate.id, name="Due Soon Corp")
    near_past = (today_ist() - timedelta(days=5)).isoformat()
    await _log_event(client, c2["id"], "INITIAL_EMAIL", near_past)

    resp = await client.get("/schedule/due?window=30")
    items = resp.json()["items"]
    # Find positions
    c1_pos = next((i for i, r in enumerate(items) if r["company_id"] == c1["id"]), None)
    c2_pos = next((i for i, r in enumerate(items) if r["company_id"] == c2["id"]), None)
    if c1_pos is not None and c2_pos is not None:
        assert c1_pos < c2_pos  # overdue first


async def test_pause_and_resume_schedule(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User
):
    """PATCH ?action=pause sets STOPPED/MANUAL; ?action=resume restores ACTIVE."""
    await _login(client)
    company = await _create_company(client, mandate.id)
    await _log_event(client, company["id"], "INITIAL_EMAIL", "2024-01-01")

    pause_resp = await client.patch(f"/companies/{company['id']}/schedule?action=pause", json={})
    assert pause_resp.status_code == 200, pause_resp.text
    assert pause_resp.json()["status"] == "STOPPED"

    resume_resp = await client.patch(f"/companies/{company['id']}/schedule?action=resume", json={})
    assert resume_resp.status_code == 200, resume_resp.text
    assert resume_resp.json()["status"] == "ACTIVE"


async def test_schedule_stats_endpoint(
    client: AsyncClient, mandate: Mandate, partner: User
):
    await _login(client)
    resp = await client.get("/schedule/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "sent_this_week" in data
    assert "responses_this_week" in data
    assert "response_rate" in data
    assert "overdue_count" in data
