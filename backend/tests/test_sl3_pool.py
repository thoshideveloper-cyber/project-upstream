"""SL-3 — firm-wide pool search + candidate overlay + warm history + saved searches."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company_profile import CompanyProfile
from app.models.enums import SourcingStageKind
from app.services.sourcing import (
    first_stage_of_kind,
    get_firm_stages,
    get_or_create_candidate,
)

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _seed_profiles(db: AsyncSession, firm_id: int) -> list[CompanyProfile]:
    profiles = [
        CompanyProfile(
            firm_id=firm_id, company_name="Alpha Corp", name_key="alpha",
            domain_key="alpha.com", website="alpha.com", hq="Mumbai",
            headcount=500, revenue_inr_cr=200,
        ),
        CompanyProfile(
            firm_id=firm_id, company_name="Beta Industries", name_key="beta",
            domain_key="beta.com", website="beta.com", hq="Delhi",
            headcount=50, revenue_inr_cr=20,
        ),
    ]
    db.add_all(profiles)
    await db.commit()
    for p in profiles:
        await db.refresh(p)
    return profiles


@pytest.mark.asyncio
async def test_pool_search_firm_wide_includes_unplaced(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    await _seed_profiles(db_session, mandate.firm_id)
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2  # firm-wide pool, never-placed included
    names = {i["company_name"] for i in data["items"]}
    assert names == {"Alpha Corp", "Beta Industries"}
    # No candidate overlay yet.
    assert all(i["candidate"] is None for i in data["items"])


@pytest.mark.asyncio
async def test_pool_filters(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    await _seed_profiles(db_session, mandate.firm_id)
    # revenue >= 100 → only Alpha
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&rev_min=100")
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["company_name"] == "Alpha Corp"
    # headcount <= 100 → only Beta
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&headcount_max=100")
    assert {i["company_name"] for i in resp.json()["items"]} == {"Beta Industries"}
    # q by HQ
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&hq=delhi")
    assert {i["company_name"] for i in resp.json()["items"]} == {"Beta Industries"}


@pytest.mark.asyncio
async def test_candidate_overlay_and_stage(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _seed_profiles(db_session, mandate.firm_id)
    stages = await get_firm_stages(db_session, mandate.firm_id)
    shortlist = first_stage_of_kind(stages, SourcingStageKind.SHORTLIST)
    await get_or_create_candidate(
        db_session,
        firm_id=mandate.firm_id,
        mandate_id=mandate.id,
        profile_id=profiles[0].id,
        stage=shortlist,
        actor_id=partner.id,
    )
    await db_session.commit()

    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&q=Alpha")
    item = resp.json()["items"][0]
    assert item["candidate"] is not None
    assert item["candidate"]["stage_kind"] == "SHORTLIST"


@pytest.mark.asyncio
async def test_warm_history_visibility(client: AsyncClient, analyst, mandate, db_session):
    """A placement in a NON-visible mandate shows existence but no detail."""
    from app.models.company import Company
    from app.models.enums import CompanyStatus, CompanyType

    await _login(client, ANALYST)
    # Assign analyst to a *second* mandate so they have a visible context but not `mandate`.
    from app.models.mandate import Mandate
    from app.models.mandate_assignment import MandateAssignment

    other = Mandate(
        firm_id=mandate.firm_id, client_name="C2", name="M2", type=mandate.type,
        status=mandate.status, lead_owner_id=None,
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(MandateAssignment(mandate_id=other.id, user_id=analyst.id))

    profiles = await _seed_profiles(db_session, mandate.firm_id)
    # Place Alpha in the (non-visible) `mandate`.
    db_session.add(
        Company(
            firm_id=mandate.firm_id, mandate_id=mandate.id, profile_id=profiles[0].id,
            company_name="Alpha Corp", type=CompanyType.BUYER,
            status=CompanyStatus.CONTACTED, category="OTHER",
        )
    )
    await db_session.commit()

    resp = await client.get(f"/sourcing/candidates?mandate_id={other.id}&q=Alpha")
    item = resp.json()["items"][0]
    assert len(item["warm_history"]) == 1
    wh = item["warm_history"][0]
    assert wh["visible"] is False
    assert wh["mandate_name"] is None  # muted — no details leaked


@pytest.mark.asyncio
async def test_saved_search_crud_and_run(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    await _seed_profiles(db_session, mandate.firm_id)

    resp = await client.post(
        "/saved-searches",
        json={"name": "Big cos", "scope": "FIRM", "criteria": {"rev_min": "100"}},
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]

    resp = await client.get("/saved-searches")
    assert resp.json()["total"] == 1

    resp = await client.post(f"/saved-searches/{sid}/run?mandate_id={mandate.id}")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1  # only Alpha has rev >= 100

    resp = await client.delete(f"/saved-searches/{sid}")
    assert resp.status_code == 200
    assert (await client.get("/saved-searches")).json()["total"] == 0


@pytest.mark.asyncio
async def test_private_saved_search_hidden_from_others(
    client: AsyncClient, partner, analyst, assigned_mandate, db_session
):
    await _login(client, PARTNER)
    resp = await client.post(
        "/saved-searches", json={"name": "mine", "scope": "PRIVATE", "criteria": {}}
    )
    assert resp.status_code == 201

    # Analyst logs in — should not see the partner's PRIVATE search.
    await _login(client, ANALYST)
    resp = await client.get("/saved-searches")
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_add_candidate_from_pool(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _seed_profiles(db_session, mandate.firm_id)
    resp = await client.post(
        "/sourcing/candidates",
        json={"mandate_id": mandate.id, "profile_id": profiles[0].id, "stage_kind": "RESEARCH"},
    )
    assert resp.status_code == 201
    assert resp.json()["created"] is True
    assert resp.json()["stage_kind"] == "RESEARCH"

    # Shortlist advances the existing Research candidate (idempotent, not a dup).
    resp = await client.post(
        "/sourcing/candidates",
        json={"mandate_id": mandate.id, "profile_id": profiles[0].id, "stage_kind": "SHORTLIST"},
    )
    assert resp.json()["created"] is False
    assert resp.json()["stage_kind"] == "SHORTLIST"


@pytest.mark.asyncio
async def test_add_candidate_rejects_active_stage(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    profiles = await _seed_profiles(db_session, mandate.firm_id)
    resp = await client.post(
        "/sourcing/candidates",
        json={"mandate_id": mandate.id, "profile_id": profiles[0].id, "stage_kind": "ACTIVE"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_csv_export(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    await _seed_profiles(db_session, mandate.firm_id)
    resp = await client.get(f"/sourcing/candidates.csv?mandate_id={mandate.id}")
    assert resp.status_code == 200
    assert "Alpha Corp" in resp.text
    assert "Company,HQ,Website" in resp.text


# ── Discover lens: warm_only / rev_band filters + /sourcing/facets ────────────


async def _place_alpha(db_session: AsyncSession, mandate, profile) -> None:
    """Give Alpha a placement so it counts as a warm door."""
    from app.models.company import Company
    from app.models.enums import CompanyType

    db_session.add(
        Company(
            firm_id=mandate.firm_id,
            mandate_id=mandate.id,
            profile_id=profile.id,
            company_name=profile.company_name,
            type=CompanyType.BUYER,
        )
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_pool_warm_only_filter(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _seed_profiles(db_session, mandate.firm_id)
    await _place_alpha(db_session, mandate, profiles[0])

    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&warm_only=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["company_name"] == "Alpha Corp"


@pytest.mark.asyncio
async def test_pool_rev_band_filter(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    await _seed_profiles(db_session, mandate.firm_id)  # Alpha 200 Cr, Beta 20 Cr

    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&rev_band=b100_500")
    assert {i["company_name"] for i in resp.json()["items"]} == {"Alpha Corp"}
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&rev_band=lt100")
    assert {i["company_name"] for i in resp.json()["items"]} == {"Beta Industries"}
    resp = await client.get(f"/sourcing/candidates?mandate_id={mandate.id}&rev_band=bogus")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_pool_facets(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _seed_profiles(db_session, mandate.firm_id)
    await _place_alpha(db_session, mandate, profiles[0])

    resp = await client.get(f"/sourcing/facets?mandate_id={mandate.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["warm"] == 1  # only Alpha has a placement
    assert data["scored"] == 0  # nothing scored yet
    # Every seeded profile lands in exactly one size band.
    bands = {b["key"]: b["count"] for b in data["size_bands"]}
    assert bands["lt100"] == 1 and bands["b100_500"] == 1
    assert bands["b500_2000"] == 0 and bands["gte2000"] == 0
    # HQ mix contains both cities; category mix is empty (placement has no category).
    hqs = {h["hq"]: h["count"] for h in data["by_hq"]}
    assert hqs == {"Mumbai": 1, "Delhi": 1}
    assert data["by_category"] == []
