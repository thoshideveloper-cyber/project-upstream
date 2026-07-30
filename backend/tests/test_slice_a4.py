"""Phase 2a Slice A4 acceptance tests — response → contact capture.

Covers (Req B / BUG-1 / BUG-5 / BUG-12 / §8-E):
- RESPONSE with an inline contact creates the contact, links the event, stops cadence.
- Per-touch sentiment/mode live on the EVENT (source of truth) and mirror to the contact cache.
- recompute_status is the single writer: INITIAL_EMAIL → CONTACTED, RESPONSE → RESPONDED;
  COLD stays derived (never a status).
- Firm-wide Contacts list exposes company/category/POC/sentiment and filters by sentiment.
"""

from __future__ import annotations

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.enums import CompanyStatus, ScheduleStatus, StoppedReason
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _make_company(client: AsyncClient, mandate_id: int, name: str = "TestCo") -> dict:
    r = await client.post("/companies", json={"company_name": name, "mandate_id": mandate_id})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_initial_email_sets_contacted(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    co = await _make_company(client, assigned_mandate.id, "Cadence Co")
    r = await client.post(
        f"/companies/{co['id']}/events",
        json={"event_type": "INITIAL_EMAIL", "occurred_on": date.today().isoformat()},
    )
    assert r.status_code == 201
    detail = await client.get(f"/companies/{co['id']}")
    assert detail.json()["status"] == CompanyStatus.CONTACTED.value


@pytest.mark.asyncio
async def test_response_captures_contact_and_stops(
    client: AsyncClient,
    db_session: AsyncSession,
    partner: User,
    assigned_mandate: Mandate,
):
    await _login(client, _PARTNER)
    co = await _make_company(client, assigned_mandate.id, "Responder Co")
    # Start the cadence.
    await client.post(
        f"/companies/{co['id']}/events",
        json={"event_type": "INITIAL_EMAIL", "occurred_on": "2026-05-01"},
    )
    # Log a RESPONSE with an inline contact + sentiment + mode.
    r = await client.post(
        f"/companies/{co['id']}/events",
        json={
            "event_type": "RESPONSE",
            "occurred_on": "2026-05-10",
            "mode": "EMAIL",
            "sentiment": "POSITIVE",
            "notes": "Keen — scheduling a call.",
            "new_contact": {"contact_person": "Patrick Kerpan", "designation": "CEO", "email": "pk@cohesive.com"},
        },
    )
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["contact_id"] is not None
    assert ev["sentiment"] == "POSITIVE"
    assert ev["mode"] == "EMAIL"

    # Company status recomputed to RESPONDED; schedule stopped RESPONDED.
    detail = await client.get(f"/companies/{co['id']}")
    assert detail.json()["status"] == CompanyStatus.RESPONDED.value
    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id == co["id"], OutreachSchedule.is_current.is_(True)
            )
        )
    ).scalar_one()
    assert sched.status == ScheduleStatus.STOPPED
    assert sched.stopped_reason == StoppedReason.RESPONDED

    # Contact created + latest-touch cache set (sentiment mirrored, BUG-12).
    contacts = (await client.get(f"/contacts?company_id={co['id']}")).json()["items"]
    assert len(contacts) == 1
    c = contacts[0]
    assert c["contact_person"] == "Patrick Kerpan"
    assert c["sentiment"] == "POSITIVE"
    assert c["mode"] == "EMAIL"
    assert c["company_name"] == "Responder Co"


@pytest.mark.asyncio
async def test_cold_is_not_a_status(
    client: AsyncClient,
    db_session: AsyncSession,
    partner: User,
    assigned_mandate: Mandate,
):
    """After exhausting the cap the schedule is EXHAUSTED (cold) but status stays CONTACTED."""
    await _login(client, _PARTNER)
    co = await _make_company(client, assigned_mandate.id, "Cold Co")
    await client.post(f"/companies/{co['id']}/events", json={"event_type": "INITIAL_EMAIL", "occurred_on": "2026-01-01"})
    # 4 follow-ups → cap reached → EXHAUSTED.
    for i in range(4):
        await client.post(
            f"/companies/{co['id']}/events",
            json={"event_type": "FOLLOW_UP", "occurred_on": f"2026-0{i + 2}-01"},
        )
    detail = await client.get(f"/companies/{co['id']}")
    assert detail.json()["is_cold"] is True
    assert detail.json()["status"] == CompanyStatus.CONTACTED.value  # cold is NOT a status


@pytest.mark.asyncio
async def test_reuse_existing_contact_by_email(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    co = await _make_company(client, assigned_mandate.id, "Dedup Contact Co")
    payload = {
        "event_type": "CALL",
        "occurred_on": "2026-05-10",
        "new_contact": {"contact_person": "Asha Rao", "email": "asha@x.com"},
    }
    await client.post(f"/companies/{co['id']}/events", json=payload)
    # Second touch, same email → must reuse, not duplicate.
    await client.post(f"/companies/{co['id']}/events", json={**payload, "occurred_on": "2026-05-20"})
    contacts = (await client.get(f"/contacts?company_id={co['id']}")).json()["items"]
    assert len([c for c in contacts if c["email"] == "asha@x.com"]) == 1


@pytest.mark.asyncio
async def test_contacts_filter_by_sentiment(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    co = await _make_company(client, assigned_mandate.id, "Sentiment Co")
    await client.post(
        f"/companies/{co['id']}/events",
        json={
            "event_type": "RESPONSE", "occurred_on": "2026-05-10", "sentiment": "NEGATIVE",
            "new_contact": {"contact_person": "Grumpy Person"},
        },
    )
    pos = (await client.get("/contacts?sentiment=POSITIVE")).json()["items"]
    neg = (await client.get("/contacts?sentiment=NEGATIVE")).json()["items"]
    assert not any(c["contact_person"] == "Grumpy Person" for c in pos)
    assert any(c["contact_person"] == "Grumpy Person" for c in neg)
