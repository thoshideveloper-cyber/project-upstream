"""Phase 2a Slice A1 acceptance tests — two-axis classification model.

Covers:
- Category vocabulary: self-seeds on first read, includes the real Excel codes.
- Category CRUD: partner creates/updates/archives; analyst is forbidden to mutate.
- Sourcing layers: per-engagement CRUD, visibility-scoped, ordered.
- Company create: category_id is source of truth + legacy enum cache stays consistent;
  legacy enum resolves a category_id; type is derived from the engagement (BUG-7).
- sourcing_layer_id validated against the engagement.
- Filters: category_id / sourcing_layer_id / unsorted.
- Inline primary contact captured on add (§7.4).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.enums import CompanyType, MandateType
from app.models.mandate import Mandate
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _seed_categories(client: AsyncClient) -> list[dict]:
    """First read self-seeds the firm's default vocabulary."""
    r = await client.get("/company-categories")
    assert r.status_code == 200, r.text
    return r.json()["items"]


# ── Category vocabulary ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_categories_self_seed_with_excel_codes(
    client: AsyncClient, partner: User
):
    await _login(client, _PARTNER)
    items = await _seed_categories(client)
    codes = {c["code"] for c in items}
    # The real Excel codes the old 6-value enum could not express are present.
    assert {"STRATEGIC", "PRIVATE_EQUITY", "PMS", "PRIVATE_CREDIT", "INVESTMENT_BANK"} <= codes
    # No invented FINANCIAL_SPONSOR.
    assert "FINANCIAL_SPONSOR" not in codes
    # Ordered by sort_order.
    orders = [c["sort_order"] for c in items]
    assert orders == sorted(orders)


@pytest.mark.asyncio
async def test_partner_creates_category_analyst_forbidden(
    client: AsyncClient, partner: User, analyst: User
):
    await _login(client, _PARTNER)
    await _seed_categories(client)
    r = await client.post("/company-categories", json={"name": "Sovereign Fund"})
    assert r.status_code == 201, r.text
    assert r.json()["code"] == "SOVEREIGN_FUND"

    # Analyst may read but not create.
    await _login(client, _ANALYST)
    r = await client.get("/company-categories")
    assert r.status_code == 200
    r = await client.post("/company-categories", json={"name": "Hedge Fund"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_category_archive_and_duplicate_code(
    client: AsyncClient, partner: User
):
    await _login(client, _PARTNER)
    await _seed_categories(client)
    r = await client.post("/company-categories", json={"name": "Growth Equity"})
    cat_id = r.json()["id"]
    # Duplicate code rejected.
    r = await client.post("/company-categories", json={"name": "Growth Equity"})
    assert r.status_code == 409
    # Archive, then re-create revives the archived row.
    r = await client.delete(f"/company-categories/{cat_id}")
    assert r.status_code == 200
    r = await client.post("/company-categories", json={"name": "Growth Equity"})
    assert r.status_code == 201
    assert r.json()["id"] == cat_id


# ── Sourcing layers ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sourcing_layers_crud_scoped(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    r = await client.post(
        "/sourcing-layers", json={"mandate_id": assigned_mandate.id, "name": "Direct"}
    )
    assert r.status_code == 201, r.text
    layer_id = r.json()["id"]
    r = await client.post(
        "/sourcing-layers", json={"mandate_id": assigned_mandate.id, "name": "Secondary"}
    )
    assert r.status_code == 201
    # Ordered append.
    r = await client.get(f"/sourcing-layers?mandate_id={assigned_mandate.id}")
    names = [layer["name"] for layer in r.json()["items"]]
    assert names == ["Direct", "Secondary"]

    # Rename + archive.
    r = await client.patch(f"/sourcing-layers/{layer_id}", json={"name": "Direct outreach"})
    assert r.status_code == 200 and r.json()["name"] == "Direct outreach"
    r = await client.delete(f"/sourcing-layers/{layer_id}")
    assert r.status_code == 200
    r = await client.get(f"/sourcing-layers?mandate_id={assigned_mandate.id}")
    assert [layer["name"] for layer in r.json()["items"]] == ["Secondary"]


@pytest.mark.asyncio
async def test_analyst_cannot_see_unassigned_mandate_layers(
    client: AsyncClient, analyst: User, mandate: Mandate
):
    # `mandate` is NOT assigned to the analyst.
    await _login(client, _ANALYST)
    r = await client.get(f"/sourcing-layers?mandate_id={mandate.id}")
    assert r.status_code == 404


# ── Company classification ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_with_category_id_sets_legacy_cache(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    cats = await _seed_categories(client)
    pe = next(c for c in cats if c["code"] == "PRIVATE_EQUITY")
    pms = next(c for c in cats if c["code"] == "PMS")

    r = await client.post(
        "/companies",
        json={"company_name": "Mandala Capital", "mandate_id": assigned_mandate.id, "category_id": pe["id"]},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category_id"] == pe["id"]
    assert body["category"] == "PRIVATE_EQUITY"  # legacy cache derived from code
    assert body["category_name"] == "Private Equity"

    # PMS has no legacy enum equivalent → cache collapses to OTHER, id preserved.
    r = await client.post(
        "/companies",
        json={"company_name": "Marcellus PMS", "mandate_id": assigned_mandate.id, "category_id": pms["id"]},
    )
    body = r.json()
    assert body["category_id"] == pms["id"]
    assert body["category"] == "OTHER"
    assert body["category_name"] == "PMS"


@pytest.mark.asyncio
async def test_legacy_enum_resolves_category_id(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    cats = await _seed_categories(client)
    vc = next(c for c in cats if c["code"] == "VENTURE_CAPITAL")
    r = await client.post(
        "/companies",
        json={"company_name": "Blume Ventures", "mandate_id": assigned_mandate.id, "category": "VENTURE_CAPITAL"},
    )
    body = r.json()
    assert body["category"] == "VENTURE_CAPITAL"
    assert body["category_id"] == vc["id"]


@pytest.mark.asyncio
async def test_type_derived_from_engagement(
    client: AsyncClient, db_session, partner: User, assigned_mandate: Mandate
):
    # assigned_mandate is SELL_SIDE → a sourced company is a BUYER.
    await _login(client, _PARTNER)
    r = await client.post(
        "/companies",
        json={"company_name": "Acquirer Co", "mandate_id": assigned_mandate.id},
    )
    assert r.status_code == 201, r.text
    assert r.json()["type"] == CompanyType.BUYER.value


@pytest.mark.asyncio
async def test_invalid_layer_rejected(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    # A layer id that doesn't belong to this engagement → 422.
    r = await client.post(
        "/companies",
        json={"company_name": "Bad Layer Co", "mandate_id": assigned_mandate.id, "sourcing_layer_id": 99999},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_filters_by_layer_and_unsorted(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    r = await client.post(
        "/sourcing-layers", json={"mandate_id": assigned_mandate.id, "name": "Band A"}
    )
    layer_id = r.json()["id"]

    await client.post(
        "/companies",
        json={"company_name": "InBand Co", "mandate_id": assigned_mandate.id, "sourcing_layer_id": layer_id},
    )
    await client.post(
        "/companies",
        json={"company_name": "Unsorted Co", "mandate_id": assigned_mandate.id},
    )

    r = await client.get(f"/companies?mandate_id={assigned_mandate.id}&sourcing_layer_id={layer_id}")
    names = [c["company_name"] for c in r.json()["items"]]
    assert names == ["InBand Co"]

    r = await client.get(f"/companies?mandate_id={assigned_mandate.id}&unsorted=true")
    names = [c["company_name"] for c in r.json()["items"]]
    assert "Unsorted Co" in names and "InBand Co" not in names


@pytest.mark.asyncio
async def test_inline_primary_contact_on_add(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    await _login(client, _PARTNER)
    r = await client.post(
        "/companies",
        json={
            "company_name": "Contactful Co",
            "mandate_id": assigned_mandate.id,
            "contacts": [
                {"contact_person": "Aditya Mody", "designation": "MD", "email": "amody@x.com"},
                {"contact_person": "Second Person"},
            ],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["primary_contact"]["contact_person"] == "Aditya Mody"

    detail = await client.get(f"/companies/{body['id']}")
    assert len(detail.json()["contacts"]) == 2
