"""Email pipeline tests — sandbox account, sending + cadence coupling, templates, pacing."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.contact import Contact
from app.models.enums import ScheduleStatus
from app.models.mandate import Mandate
from app.models.outreach_schedule import OutreachSchedule
from app.models.sent_email import SentEmail
from app.models.user import User

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient) -> None:
    resp = await client.post("/auth/login", json=PARTNER)
    assert resp.status_code == 200


async def _create_company(client: AsyncClient, mandate_id: int, name: str = "Email Corp") -> dict:
    resp = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET"},
    )
    assert resp.status_code == 201
    return resp.json()


async def _connect_sandbox(client: AsyncClient) -> dict:
    resp = await client.post("/email/account/sandbox")
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_account_starts_disconnected(client: AsyncClient, partner: User):
    await _login(client)
    resp = await client.get("/email/account")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["providers"]["sandbox"] is True


@pytest.mark.asyncio
async def test_sandbox_connect_and_update(client: AsyncClient, partner: User):
    await _login(client)
    data = await _connect_sandbox(client)
    assert data["connected"] is True
    assert data["provider"] == "SANDBOX"
    assert data["email_address"] == PARTNER["email"]
    # Default signature is prefilled from the user + firm.
    assert "Test Partner" in (data["signature"] or "")

    resp = await client.patch(
        "/email/account", json={"signature": "TP\nUpstream", "daily_send_limit": 10}
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["signature"] == "TP\nUpstream"
    assert updated["daily_send_limit"] == 10

    resp = await client.delete("/email/account")
    assert resp.status_code == 204
    resp = await client.get("/email/account")
    assert resp.json()["connected"] is False


@pytest.mark.asyncio
async def test_send_requires_account(client: AsyncClient, partner: User, mandate: Mandate):
    await _login(client)
    company = await _create_company(client, mandate.id)
    resp = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "cfo@target.com",
            "subject": "Hello",
            "body": "Test body",
            "event_type": "INITIAL_EMAIL",
        },
    )
    assert resp.status_code == 400
    assert "Connect" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_send_initial_activates_schedule(
    client: AsyncClient, db_session: AsyncSession, partner: User, mandate: Mandate
):
    await _login(client)
    await _connect_sandbox(client)
    company = await _create_company(client, mandate.id)

    resp = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "cfo@target.com",
            "subject": "Intro",
            "body": "Hi there — intro.",
            "event_type": "INITIAL_EMAIL",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "SIMULATED"
    assert data["sends_today"] == 1
    assert data["event_id"] is not None

    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company["id"])
        )
    ).scalar_one()
    assert sched.status == ScheduleStatus.ACTIVE
    assert sched.initial_date is not None

    sent = (
        await db_session.execute(
            select(SentEmail).where(SentEmail.company_id == company["id"])
        )
    ).scalar_one()
    assert sent.event_id == data["event_id"]
    # Signature appended server-side — the archive matches the wire.
    assert "Test Partner" in sent.body_text


@pytest.mark.asyncio
async def test_send_follow_up_and_daily_cap(
    client: AsyncClient, partner: User, mandate: Mandate
):
    await _login(client)
    await _connect_sandbox(client)
    await client.patch("/email/account", json={"daily_send_limit": 2})
    company = await _create_company(client, mandate.id)

    r1 = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "cfo@target.com",
            "subject": "Intro",
            "body": "First.",
            "event_type": "INITIAL_EMAIL",
        },
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "cfo@target.com",
            "subject": "Follow-up",
            "body": "Second.",
            "event_type": "FOLLOW_UP",
        },
    )
    assert r2.status_code == 201
    assert r2.json()["sends_today"] == 2

    r3 = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "cfo@target.com",
            "subject": "Over cap",
            "body": "Third.",
            "event_type": "FOLLOW_UP",
        },
    )
    assert r3.status_code == 429


@pytest.mark.asyncio
async def test_send_rejects_bad_input(client: AsyncClient, partner: User, mandate: Mandate):
    await _login(client)
    await _connect_sandbox(client)
    company = await _create_company(client, mandate.id)

    bad_addr = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "not-an-email",
            "subject": "x",
            "body": "y",
        },
    )
    assert bad_addr.status_code == 400

    bad_type = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "a@b.co",
            "subject": "x",
            "body": "y",
            "event_type": "RESPONSE",
        },
    )
    assert bad_type.status_code == 400


@pytest.mark.asyncio
async def test_send_with_contact_updates_cache(
    client: AsyncClient, db_session: AsyncSession, partner: User, mandate: Mandate
):
    await _login(client)
    await _connect_sandbox(client)
    company = await _create_company(client, mandate.id)
    resp = await client.post(
        "/contacts",
        json={
            "company_id": company["id"],
            "contact_person": "Priya CFO",
            "email": "priya@target.com",
            "is_primary": True,
        },
    )
    assert resp.status_code == 201
    contact_id = resp.json()["id"]

    resp = await client.post(
        "/email/send",
        json={
            "company_id": company["id"],
            "to_email": "priya@target.com",
            "subject": "Intro",
            "body": "Hello Priya.",
            "event_type": "INITIAL_EMAIL",
            "contact_id": contact_id,
        },
    )
    assert resp.status_code == 201
    contact = (
        await db_session.execute(select(Contact).where(Contact.id == contact_id))
    ).scalar_one()
    assert contact.last_contact_date is not None

    # The schedule queue row now carries the primary contact for compose prefill.
    queue = await client.get("/schedule/due?window=90")
    rows = [r for r in queue.json()["items"] if r["company_id"] == company["id"]]
    assert rows and rows[0]["primary_contact"]["email"] == "priya@target.com"


@pytest.mark.asyncio
async def test_templates_crud_and_permissions(
    client: AsyncClient, partner: User, analyst: User, firm
):
    await _login(client)
    created = await client.post(
        "/email/templates",
        json={
            "name": "My bump",
            "kind": "BUMP",
            "subject": "Quick one — {{company}}",
            "body": "Hi {{first_name}}, quick nudge.",
        },
    )
    assert created.status_code == 201
    tpl = created.json()

    listed = await client.get("/email/templates")
    assert listed.status_code == 200
    assert any(t["id"] == tpl["id"] for t in listed.json()["items"])

    patched = await client.patch(f"/email/templates/{tpl['id']}", json={"name": "Renamed"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Renamed"

    # Another user cannot edit someone else's personal template.
    await client.post("/auth/login", json={"email": "analyst@test.com", "password": "Passw0rd!"})
    forbidden = await client.patch(f"/email/templates/{tpl['id']}", json={"name": "Steal"})
    assert forbidden.status_code == 403

    await client.post("/auth/login", json=PARTNER)
    deleted = await client.delete(f"/email/templates/{tpl['id']}")
    assert deleted.status_code == 204
    listed = await client.get("/email/templates")
    assert not any(t["id"] == tpl["id"] for t in listed.json()["items"])


@pytest.mark.asyncio
async def test_draft_unavailable_without_keys(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, partner: User, mandate: Mandate
):
    await _login(client)
    company = await _create_company(client, mandate.id)
    monkeypatch.setattr(settings, "groq_api_key", None)
    monkeypatch.setattr(settings, "groq_api_key_2", None)
    monkeypatch.setattr(settings, "groq_api_key_3", None)
    resp = await client.post("/email/draft", json={"company_id": company["id"]})
    assert resp.status_code == 503
