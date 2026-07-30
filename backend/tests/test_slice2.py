"""Slice-2 acceptance tests — cadence cycle engine: cap, EXHAUSTED, restart, cold queue.

Covers:
- effective_cap resolves mandate override > firm default > hard default 4
- FOLLOW_UP auto-stops at cap with stopped_reason=EXHAUSTED
- compute_cadence surfaces is_cold=True when EXHAUSTED
- POST /companies/{id}/restart opens cycle 2 with fresh null anchor + new contact
- Old events are intact; old cycle is queryable via GET /companies/{id}/cycles
- GET /schedule/cold returns only EXHAUSTED current-cycle companies (firm-scoped)
- Analyst only sees cold companies on their assigned mandates
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
    StoppedReason,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.user import User
from app.services.cadence import compute_cadence, effective_cap

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _make_company(client: AsyncClient, mandate_id: int, name: str = "TestCo") -> dict:
    r = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _log_event(
    client: AsyncClient,
    company_id: int,
    event_type: str,
    on: date | None = None,
) -> dict:
    payload: dict = {
        "event_type": event_type,
        "occurred_on": (on or date.today()).isoformat(),
    }
    r = await client.post(f"/companies/{company_id}/events", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ── effective_cap (unit) ──────────────────────────────────────────────────────


def _make_firm(cap: int) -> Firm:
    f = Firm(name="F")
    f.follow_up_cap = cap
    return f


def _make_mandate(cap: int | None) -> Mandate:
    m = Mandate(
        firm_id=1, client_name="C", name="M",
        type=MandateType.SELL_SIDE, status=MandateStatus.ACTIVE,
    )
    m.follow_up_cap = cap
    return m


def test_effective_cap_mandate_override():
    assert effective_cap(_make_firm(4), _make_mandate(2)) == 2


def test_effective_cap_firm_default():
    assert effective_cap(_make_firm(6), _make_mandate(None)) == 6


def test_effective_cap_hard_default():
    f = _make_firm(4)
    f.follow_up_cap = None  # type: ignore[assignment]
    assert effective_cap(f, _make_mandate(None)) == 4


# ── compute_cadence exposes is_cold ──────────────────────────────────────────


def test_compute_cadence_is_cold_when_exhausted():
    sched = OutreachSchedule(
        firm_id=1, company_id=1, cycle_number=1, is_current=True,
        status=ScheduleStatus.STOPPED, stopped_reason=StoppedReason.EXHAUSTED,
    )
    result = compute_cadence(sched, 4)
    assert result["is_cold"] is True
    assert result["cycle_number"] == 1


def test_compute_cadence_not_cold_when_responded():
    sched = OutreachSchedule(
        firm_id=1, company_id=1, cycle_number=1, is_current=True,
        status=ScheduleStatus.STOPPED, stopped_reason=StoppedReason.RESPONDED,
    )
    result = compute_cadence(sched, 0)
    assert result["is_cold"] is False


def test_compute_cadence_not_cold_when_active():
    sched = OutreachSchedule(
        firm_id=1, company_id=1, cycle_number=1, is_current=True,
        status=ScheduleStatus.ACTIVE,
        initial_date=date(2025, 1, 1),
        cadence_interval_days=14,
    )
    result = compute_cadence(sched, 0)
    assert result["is_cold"] is False
    assert result["cycle_number"] == 1


# ── Auto-EXHAUSTED on FOLLOW_UP cap (HTTP) ────────────────────────────────────


@pytest.mark.asyncio
async def test_follow_up_cap_auto_exhausts(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """Logging FOLLOW_UP N times (where N = firm.follow_up_cap = 4) auto-stops EXHAUSTED."""
    await _login(client, _PARTNER)

    # Set the firm cap to 2 to keep the test short
    firm.follow_up_cap = 2
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Cap Test Corp")
    company_id = company["id"]

    # Activate schedule
    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)

    # First follow-up — still ACTIVE
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)
    r = await client.get(f"/companies/{company_id}/schedule")
    assert r.status_code == 200
    assert r.json()["status"] == ScheduleStatus.ACTIVE.value

    # Second follow-up — hits cap (2); must auto-stop EXHAUSTED
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    r = await client.get(f"/companies/{company_id}/schedule")
    data = r.json()
    assert data["status"] == ScheduleStatus.STOPPED.value
    assert data["stopped_reason"] == StoppedReason.EXHAUSTED.value

    # GET /companies/{id} must surface is_cold=True
    r2 = await client.get(f"/companies/{company_id}")
    assert r2.json()["is_cold"] is True


@pytest.mark.asyncio
async def test_mandate_cap_overrides_firm_cap(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """mandate.follow_up_cap overrides firm.follow_up_cap."""
    await _login(client, _PARTNER)

    # Firm cap = 4, mandate cap = 1 — should exhaust after 1 follow-up
    firm.follow_up_cap = 4
    assigned_mandate.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Mandate Cap Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    r = await client.get(f"/companies/{company_id}/schedule")
    data = r.json()
    assert data["status"] == ScheduleStatus.STOPPED.value
    assert data["stopped_reason"] == StoppedReason.EXHAUSTED.value


@pytest.mark.asyncio
async def test_response_before_cap_does_not_exhaust(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """A RESPONSE/BOUNCE before the cap stops with RESPONDED, not EXHAUSTED."""
    await _login(client, _PARTNER)

    firm.follow_up_cap = 2
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Responded Before Cap")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)

    # Log a RESPONSE (stops with RESPONDED)
    await _log_event(client, company_id, OutreachEventType.RESPONSE.value)

    # FOLLOW_UPs after a response should NOT change the stopped_reason
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    r = await client.get(f"/companies/{company_id}/schedule")
    data = r.json()
    assert data["status"] == ScheduleStatus.STOPPED.value
    assert data["stopped_reason"] == StoppedReason.RESPONDED.value
    # is_cold must be False (only EXHAUSTED = cold)
    r2 = await client.get(f"/companies/{company_id}")
    assert r2.json()["is_cold"] is False


# ── restart_cycle (HTTP) ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_restart_opens_cycle_2(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """POST /companies/{id}/restart opens cycle 2 with fresh AWAITING_INITIAL anchor."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Restart Corp")
    company_id = company["id"]

    # Exhaust cycle 1
    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    r_sched = await client.get(f"/companies/{company_id}/schedule")
    assert r_sched.json()["stopped_reason"] == StoppedReason.EXHAUSTED.value

    # Create a new contact for cycle 2
    contact_resp = await client.post(
        "/contacts",
        json={
            "company_id": company_id,
            "contact_person": "New Contact",
            "is_primary": False,
        },
    )
    assert contact_resp.status_code == 201, contact_resp.text
    new_contact_id = contact_resp.json()["id"]

    # Restart
    r = await client.post(
        f"/companies/{company_id}/restart",
        json={"contact_id": new_contact_id},
    )
    assert r.status_code == 201, r.text
    new_sched = r.json()
    assert new_sched["cycle_number"] == 2
    assert new_sched["status"] == ScheduleStatus.AWAITING_INITIAL.value
    assert new_sched["contact_id"] == new_contact_id
    assert new_sched["initial_date"] is None
    assert new_sched["is_cold"] is False
    assert new_sched["is_current"] is True


@pytest.mark.asyncio
async def test_restart_preserves_old_events(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """Old cycle events remain intact after restart; new cycle gets a NOTE."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "History Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    await client.post(f"/companies/{company_id}/restart", json={"contact_id": None})

    # All events (cycle 1 INITIAL + FOLLOW_UP + cycle 2 NOTE)
    r = await client.get(f"/companies/{company_id}/events")
    events = r.json()
    types = [e["event_type"] for e in events]
    assert OutreachEventType.INITIAL_EMAIL.value in types
    assert OutreachEventType.FOLLOW_UP.value in types
    assert OutreachEventType.NOTE.value in types
    assert len(events) == 3


@pytest.mark.asyncio
async def test_restart_rejects_active_cycle(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """POST /restart on an ACTIVE cycle must return 400."""
    await _login(client, _PARTNER)
    company = await _make_company(client, assigned_mandate.id, "Active Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)

    r = await client.post(f"/companies/{company_id}/restart", json={"contact_id": None})
    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_get_cycles_returns_history(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """GET /companies/{id}/cycles returns all cycles in order."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Multi Cycle Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)
    await client.post(f"/companies/{company_id}/restart", json={"contact_id": None})

    r = await client.get(f"/companies/{company_id}/cycles")
    data = r.json()
    assert data["total"] == 2
    items = data["items"]
    assert items[0]["cycle_number"] == 1
    assert items[0]["is_current"] is False
    assert items[0]["stopped_reason"] == StoppedReason.EXHAUSTED.value
    assert items[1]["cycle_number"] == 2
    assert items[1]["is_current"] is True
    assert items[1]["status"] == ScheduleStatus.AWAITING_INITIAL.value


# ── /schedule/cold (HTTP) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cold_queue_contains_exhausted(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """GET /schedule/cold returns companies whose current cycle is EXHAUSTED."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Cold Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    r = await client.get("/schedule/cold")
    assert r.status_code == 200, r.text
    data = r.json()
    ids = [item["company_id"] for item in data["items"]]
    assert company_id in ids


@pytest.mark.asyncio
async def test_cold_queue_excludes_responded(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """GET /schedule/cold must NOT include RESPONDED companies."""
    await _login(client, _PARTNER)

    company = await _make_company(client, assigned_mandate.id, "Responded Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.RESPONSE.value)

    r = await client.get("/schedule/cold")
    ids = [item["company_id"] for item in r.json()["items"]]
    assert company_id not in ids


@pytest.mark.asyncio
async def test_cold_queue_excludes_restarted(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    assigned_mandate: Mandate,
):
    """After a restart, the restarted company is no longer in the cold queue."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    company = await _make_company(client, assigned_mandate.id, "Restarted Corp")
    company_id = company["id"]

    await _log_event(client, company_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, company_id, OutreachEventType.FOLLOW_UP.value)

    # Confirm it's cold
    r = await client.get("/schedule/cold")
    assert company_id in [item["company_id"] for item in r.json()["items"]]

    # Restart — now the current cycle is AWAITING_INITIAL, no longer cold
    await client.post(f"/companies/{company_id}/restart", json={"contact_id": None})

    r2 = await client.get("/schedule/cold")
    assert company_id not in [item["company_id"] for item in r2.json()["items"]]


@pytest.mark.asyncio
async def test_cold_queue_analyst_scoping(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    analyst: User,
    assigned_mandate: Mandate,
):
    """Analyst only sees cold companies from their assigned mandates."""
    await _login(client, _PARTNER)
    firm.follow_up_cap = 1
    await db_session.commit()

    # Company on the analyst's mandate
    company_theirs = await _make_company(client, assigned_mandate.id, "Analyst Cold Corp")
    c1_id = company_theirs["id"]
    await _log_event(client, c1_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, c1_id, OutreachEventType.FOLLOW_UP.value)

    # Company on a mandate the analyst is NOT assigned to
    other_mandate = Mandate(
        firm_id=firm.id, client_name="Other", name="Other Mandate",
        type=MandateType.BUY_SIDE, status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(other_mandate)
    await db_session.commit()
    await db_session.refresh(other_mandate)

    company_other = await _make_company(client, other_mandate.id, "Other Cold Corp")
    c2_id = company_other["id"]
    await _log_event(client, c2_id, OutreachEventType.INITIAL_EMAIL.value)
    await _log_event(client, c2_id, OutreachEventType.FOLLOW_UP.value)

    # Analyst must see only their mandate's cold company
    r = await client.post("/auth/login", json=_ANALYST)
    assert r.status_code == 200

    r_cold = await client.get("/schedule/cold")
    ids = [item["company_id"] for item in r_cold.json()["items"]]
    assert c1_id in ids
    assert c2_id not in ids
