"""Mandate endpoint tests (Phase 7) — list scoping, CRUD, assignments, archive/unarchive."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.user import User

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds=None) -> None:
    resp = await client.post("/auth/login", json=creds or PARTNER)
    assert resp.status_code == 200, resp.text


async def _make_mandate(client: AsyncClient, name: str = "New Deal", **extra) -> dict:
    resp = await client.post(
        "/mandates",
        json={"client_name": "Acme Client", "name": name, "type": "SELL_SIDE", **extra},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_company(client: AsyncClient, mandate_id: int, name: str = "Co", **extra) -> dict:
    resp = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET", **extra},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── List + scoping ────────────────────────────────────────────────────────────


async def test_list_mandates_partner_sees_all(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    resp = await client.get("/mandates")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data and "total" in data
    ids = [m["id"] for m in data["items"]]
    assert mandate.id in ids


async def test_list_includes_stats(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "StatCo")
    resp = await client.get("/mandates")
    row = next(m for m in resp.json()["items"] if m["id"] == mandate.id)
    assert "total" in row
    assert "responded_pct" in row
    assert row["total"] >= 1


async def test_analyst_sees_only_assigned(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User, analyst: User
):
    # mandate is NOT assigned to analyst → analyst should see empty list
    await _login(client, ANALYST)
    resp = await client.get("/mandates")
    ids = [m["id"] for m in resp.json()["items"]]
    assert mandate.id not in ids


async def test_analyst_sees_assigned_mandate(
    client: AsyncClient, assigned_mandate: Mandate, partner: User, analyst: User
):
    await _login(client, ANALYST)
    resp = await client.get("/mandates")
    ids = [m["id"] for m in resp.json()["items"]]
    assert assigned_mandate.id in ids


async def test_list_requires_auth(client: AsyncClient):
    assert (await client.get("/mandates")).status_code == 401


# ── Create / Edit (partner only) ──────────────────────────────────────────────


async def test_create_mandate_partner(client: AsyncClient, partner: User):
    await _login(client)
    m = await _make_mandate(client, "Project Falcon")
    assert m["name"] == "Project Falcon"
    assert m["firm_id"] == partner.firm_id


async def test_create_mandate_analyst_auto_assigned(
    client: AsyncClient, partner: User, analyst: User
):
    """Analysts can open engagements; the creator is auto-assigned so it's visible."""
    await _login(client, ANALYST)
    resp = await client.post(
        "/mandates",
        json={"client_name": "X", "name": "Y", "type": "BUY_SIDE"},
    )
    assert resp.status_code == 201, resp.text
    created_id = resp.json()["id"]

    listing = await client.get("/mandates")
    assert listing.status_code == 200
    assert created_id in [m["id"] for m in listing.json()["items"]]


async def test_update_mandate(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    resp = await client.patch(f"/mandates/{mandate.id}", json={"status": "ON_HOLD"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ON_HOLD"


async def test_update_mandate_analyst_403(
    client: AsyncClient, assigned_mandate: Mandate, partner: User, analyst: User
):
    await _login(client, ANALYST)
    resp = await client.patch(f"/mandates/{assigned_mandate.id}", json={"status": "CLOSED"})
    assert resp.status_code == 403


# ── Detail + stats ────────────────────────────────────────────────────────────


async def test_get_mandate_detail(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "DetailCo")
    resp = await client.get(f"/mandates/{mandate.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "stats" in data
    assert "assignments" in data
    assert data["stats"]["total"] >= 1


async def test_get_mandate_not_found(client: AsyncClient, partner: User):
    await _login(client)
    assert (await client.get("/mandates/99999")).status_code == 404


async def test_mandate_companies(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "Under1")
    await _make_company(client, mandate.id, "Under2")
    resp = await client.get(f"/mandates/{mandate.id}/companies")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


# ── Assignments (partner only) ────────────────────────────────────────────────


async def test_assign_changes_analyst_visibility(
    client: AsyncClient, db_session: AsyncSession, mandate: Mandate, partner: User, analyst: User
):
    # Before: analyst can't see the mandate
    await _login(client, ANALYST)
    before = await client.get("/mandates")
    assert mandate.id not in [m["id"] for m in before.json()["items"]]

    # Partner assigns the analyst
    await _login(client)  # re-login as partner (overwrites cookies)
    assign = await client.post(f"/mandates/{mandate.id}/assignments", json={"user_id": analyst.id})
    assert assign.status_code in (200, 201)

    # After: analyst now sees it
    await _login(client, ANALYST)
    after = await client.get("/mandates")
    assert mandate.id in [m["id"] for m in after.json()["items"]]


async def test_assign_analyst_forbidden(
    client: AsyncClient, assigned_mandate: Mandate, partner: User, analyst: User
):
    await _login(client, ANALYST)
    resp = await client.post(
        f"/mandates/{assigned_mandate.id}/assignments", json={"user_id": analyst.id}
    )
    assert resp.status_code == 403


async def test_unassign_user(
    client: AsyncClient, db_session: AsyncSession, assigned_mandate: Mandate, partner: User, analyst: User
):
    await _login(client)
    resp = await client.delete(f"/mandates/{assigned_mandate.id}/assignments/{analyst.id}")
    assert resp.status_code == 200

    # analyst no longer sees it
    await _login(client, ANALYST)
    after = await client.get("/mandates")
    assert assigned_mandate.id not in [m["id"] for m in after.json()["items"]]


# ── Archive / Unarchive ───────────────────────────────────────────────────────


async def test_archive_and_unarchive_mandate(
    client: AsyncClient, mandate: Mandate, partner: User
):
    await _login(client)
    # Archive
    arch = await client.post(f"/mandates/{mandate.id}/archive")
    assert arch.status_code == 200
    # Hidden from default list
    default = await client.get("/mandates")
    assert mandate.id not in [m["id"] for m in default.json()["items"]]
    # Visible with include_archived
    with_arch = await client.get("/mandates?include_archived=true")
    assert mandate.id in [m["id"] for m in with_arch.json()["items"]]
    # Unarchive
    unarch = await client.post(f"/mandates/{mandate.id}/unarchive")
    assert unarch.status_code == 200
    restored = await client.get("/mandates")
    assert mandate.id in [m["id"] for m in restored.json()["items"]]


async def test_archive_mandate_analyst_403(
    client: AsyncClient, assigned_mandate: Mandate, partner: User, analyst: User
):
    await _login(client, ANALYST)
    resp = await client.post(f"/mandates/{assigned_mandate.id}/archive")
    assert resp.status_code == 403


# ── Users endpoint ────────────────────────────────────────────────────────────


async def test_list_users(client: AsyncClient, partner: User, analyst: User):
    await _login(client)
    resp = await client.get("/users")
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()["items"]]
    assert "partner@test.com" in emails
    assert "analyst@test.com" in emails
