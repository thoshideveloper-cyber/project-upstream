"""Phase 2a Slice A2 acceptance tests — shared company profiles (the bridge).

Covers (Req A):
- Adding the same company (by domain) in two engagements shares ONE profile.
- Enriching a static fact on one engagement's row propagates to the other (Trunorth).
- The legacy per-mandate read shape is unchanged (cache columns still populated).
- Firm-wide master search (/company-profiles) returns one row per company with its
  per-engagement placements, visibility-scoped.
- extract_domain no longer collapses distinct .co.in companies.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MandateStatus, MandateType
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.user import User
from app.services.cross_mandate import extract_domain

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


@pytest_asyncio.fixture
async def second_mandate(db_session: AsyncSession, mandate: Mandate, partner: User) -> Mandate:
    m = Mandate(
        firm_id=mandate.firm_id,
        client_name="Second Client",
        name="Second Mandate",
        type=MandateType.CAPITAL_RAISE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


def test_extract_domain_multi_tld():
    assert extract_domain("https://www.eris.co.in") == "eris.co.in"
    assert extract_domain("https://cipla.co.in") == "cipla.co.in"
    # distinct .co.in companies must NOT collapse
    assert extract_domain("eris.co.in") != extract_domain("cipla.co.in")
    # plain .com unchanged (existing behaviour)
    assert extract_domain("https://www.tata.com") == "tata.com"


@pytest.mark.asyncio
async def test_same_company_shares_profile_across_engagements(
    client: AsyncClient, partner: User, mandate: Mandate, second_mandate: Mandate
):
    await _login(client, _PARTNER)
    r1 = await client.post(
        "/companies",
        json={"company_name": "Trunorth Advisors", "mandate_id": mandate.id, "website": "trunorth.com"},
    )
    r2 = await client.post(
        "/companies",
        json={"company_name": "TruNorth", "mandate_id": second_mandate.id, "website": "https://www.trunorth.com"},
    )
    assert r1.status_code == 201 and r2.status_code == 201
    c1 = await client.get(f"/companies/{r1.json()['id']}")
    c2 = await client.get(f"/companies/{r2.json()['id']}")
    # Same shared profile despite different mandates and name spellings.
    assert c1.json()["profile_id"] == c2.json()["profile_id"]
    assert c1.json()["profile_id"] is not None


@pytest.mark.asyncio
async def test_enrichment_propagates_across_engagements(
    client: AsyncClient, partner: User, mandate: Mandate, second_mandate: Mandate
):
    await _login(client, _PARTNER)
    r1 = await client.post(
        "/companies",
        json={"company_name": "Trunorth", "mandate_id": mandate.id, "website": "trunorth.com"},
    )
    r2 = await client.post(
        "/companies",
        json={"company_name": "Trunorth", "mandate_id": second_mandate.id, "website": "trunorth.com"},
    )
    cid1, cid2 = r1.json()["id"], r2.json()["id"]

    # Enrich revenue on engagement 1 → must show on engagement 2 (Req A).
    patch = await client.patch(f"/companies/{cid1}", json={"revenue_inr_cr": "585.00", "headcount": 1200})
    assert patch.status_code == 200
    c2 = await client.get(f"/companies/{cid2}")
    assert float(c2.json()["revenue_inr_cr"]) == 585.0
    assert c2.json()["headcount"] == 1200


@pytest.mark.asyncio
async def test_master_search_lists_placements(
    client: AsyncClient, partner: User, mandate: Mandate, second_mandate: Mandate
):
    await _login(client, _PARTNER)
    await client.post(
        "/companies",
        json={"company_name": "Convergent Finance", "mandate_id": mandate.id, "website": "convergent.com"},
    )
    await client.post(
        "/companies",
        json={"company_name": "Convergent Finance", "mandate_id": second_mandate.id, "website": "convergent.com"},
    )

    r = await client.get("/company-profiles?q=Convergent")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    prof = items[0]
    assert prof["company_name"] == "Convergent Finance"
    assert prof["engagement_count"] == 2
    mandate_ids = {p["mandate_id"] for p in prof["placements"]}
    assert mandate_ids == {mandate.id, second_mandate.id}


@pytest.mark.asyncio
async def test_master_search_visibility_scoped(
    client: AsyncClient,
    db_session: AsyncSession,
    analyst: User,
    partner: User,
    mandate: Mandate,
    second_mandate: Mandate,
):
    # Partner adds a company in each mandate.
    await _login(client, _PARTNER)
    await client.post(
        "/companies",
        json={"company_name": "VisibleCo", "mandate_id": mandate.id, "website": "visibleco.com"},
    )
    await client.post(
        "/companies",
        json={"company_name": "HiddenCo", "mandate_id": second_mandate.id, "website": "hiddenco.com"},
    )
    # Assign only `mandate` to the analyst.
    db_session.add(MandateAssignment(mandate_id=mandate.id, user_id=analyst.id))
    await db_session.commit()

    await _login(client, {"email": "analyst@test.com", "password": "Passw0rd!"})
    r = await client.get("/company-profiles")
    names = {p["company_name"] for p in r.json()["items"]}
    assert "VisibleCo" in names
    assert "HiddenCo" not in names
