"""SL-5 — kanban board data + bulk shortlist."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_profile import CompanyProfile

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _profiles(db: AsyncSession, firm_id: int, n: int) -> list[CompanyProfile]:
    ps = [
        CompanyProfile(
            firm_id=firm_id, company_name=f"Co {i}", name_key=f"co {i}",
            domain_key=f"co{i}.com", website=f"co{i}.com",
        )
        for i in range(n)
    ]
    db.add_all(ps)
    await db.commit()
    for p in ps:
        await db.refresh(p)
    return ps


@pytest.mark.asyncio
async def test_bulk_shortlist_and_board(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _profiles(db_session, mandate.firm_id, 3)
    resp = await client.post(
        "/sourcing/candidates/bulk",
        json={
            "mandate_id": mandate.id,
            "profile_ids": [p.id for p in profiles],
            "stage_kind": "SHORTLIST",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["count"] == 3

    # Board groups them under the Shortlisted column.
    resp = await client.get(f"/sourcing/board?mandate_id={mandate.id}")
    assert resp.status_code == 200
    cols = {c["stage"]["kind"]: c for c in resp.json()["columns"]}
    assert cols["SHORTLIST"]["count"] == 3
    assert cols["RESEARCH"]["count"] == 0
    names = {c["company_name"] for c in cols["SHORTLIST"]["candidates"]}
    assert names == {"Co 0", "Co 1", "Co 2"}


@pytest.mark.asyncio
async def test_bulk_rejects_active(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _profiles(db_session, mandate.firm_id, 1)
    resp = await client.post(
        "/sourcing/candidates/bulk",
        json={"mandate_id": mandate.id, "profile_ids": [profiles[0].id], "stage_kind": "ACTIVE"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_board_visibility(client: AsyncClient, analyst, mandate, db_session):
    """Analyst not on the mandate → 404 (no board leak)."""
    await _login(client, {"email": "analyst@test.com", "password": "Passw0rd!"})
    resp = await client.get(f"/sourcing/board?mandate_id={mandate.id}")
    assert resp.status_code == 404
