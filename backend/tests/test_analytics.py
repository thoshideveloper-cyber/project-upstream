"""Analytics endpoint tests (Phase 6 — A-01/A-02 + benchmark + sources)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mandate import Mandate
from app.models.user import User

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds=None) -> None:
    resp = await client.post("/auth/login", json=creds or PARTNER)
    assert resp.status_code == 200


async def _make_company(client: AsyncClient, mandate_id: int, name: str = "Corp", **extra) -> dict:
    resp = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET", **extra},
    )
    assert resp.status_code == 201
    return resp.json()


async def _log_event(client: AsyncClient, company_id: int, event_type: str, occurred_on: str) -> dict:
    resp = await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": event_type, "occurred_on": occurred_on},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Overview ──────────────────────────────────────────────────────────────────


async def test_overview_basic(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "Alpha")
    await _make_company(client, mandate.id, "Beta")

    resp = await client.get("/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "by_status" in data
    assert "responded_pct" in data
    assert "due_this_week" in data
    assert "overdue" in data
    assert "needs_initial" in data
    assert data["total"] >= 2


async def test_overview_needs_initial_count(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "Gamma")
    await _make_company(client, mandate.id, "Delta")

    resp = await client.get("/analytics/overview")
    assert resp.json()["needs_initial"] >= 2


async def test_overview_responded_pct(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    c1 = await _make_company(client, mandate.id, "Resp1")
    c2 = await _make_company(client, mandate.id, "NoResp")

    # Activate c1 then log RESPONSE
    await _log_event(client, c1["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c1["id"], "RESPONSE", "2024-01-10")

    resp = await client.get("/analytics/overview")
    data = resp.json()
    assert data["responded_pct"] > 0.0


async def test_overview_requires_auth(client: AsyncClient):
    assert (await client.get("/analytics/overview")).status_code == 401


# ── Response by bucket (A-01) ─────────────────────────────────────────────────


async def test_response_by_category(client: AsyncClient, mandate: Mandate, partner: User):
    """Analytics groups by the firm's category vocabulary (BUG-10 — Axis 1)."""
    await _login(client)
    await client.get("/company-categories")  # seed vocab so enum → category_id resolves
    await _make_company(client, mandate.id, "Cat1", category="STRATEGIC")
    await _make_company(client, mandate.id, "Cat2", category="STRATEGIC")
    await _make_company(client, mandate.id, "Cat3", category="FINANCIAL_SPONSOR")

    resp = await client.get("/analytics/response-by-category")
    assert resp.status_code == 200
    cats = {row["category"] for row in resp.json()["items"]}
    assert "Strategic" in cats
    # FINANCIAL_SPONSOR folds into Private Equity (§7.2).
    assert "Private Equity" in cats


async def test_response_by_category_response_rate(client: AsyncClient, mandate: Mandate, partner: User):
    """After logging a RESPONSE, the category response rate > 0."""
    await _login(client)
    await client.get("/company-categories")
    c = await _make_company(client, mandate.id, "RateCo", category="PRIVATE_EQUITY")
    await _log_event(client, c["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c["id"], "RESPONSE", "2024-01-15")

    resp = await client.get("/analytics/response-by-category")
    pe_row = next((r for r in resp.json()["items"] if r["category"] == "Private Equity"), None)
    assert pe_row is not None
    assert pe_row["response_rate"] > 0.0


async def test_response_by_layer(client: AsyncClient, mandate: Mandate, partner: User):
    """Analytics also groups by sourcing layer (BUG-10 — Axis 2)."""
    await _login(client)
    r = await client.post("/sourcing-layers", json={"mandate_id": mandate.id, "name": "Direct"})
    layer_id = r.json()["id"]
    await _make_company(client, mandate.id, "LayerCo", sourcing_layer_id=layer_id)
    await _make_company(client, mandate.id, "UnsortedCo")

    resp = await client.get("/analytics/response-by-layer")
    assert resp.status_code == 200
    labels = {row["layer"] for row in resp.json()["items"]}
    assert "Direct" in labels
    assert "Unsorted" in labels


async def test_response_by_bucket_legacy_shim(client: AsyncClient, mandate: Mandate, partner: User):
    """The deprecated /response-by-bucket still works, mirroring category into `bucket`."""
    await _login(client)
    await client.get("/company-categories")
    await _make_company(client, mandate.id, "ShimCo", category="STRATEGIC")
    resp = await client.get("/analytics/response-by-bucket")
    assert resp.status_code == 200
    rows = resp.json()["items"]
    assert any(row.get("bucket") == row.get("category") for row in rows)


# ── By-analyst (A-02) ────────────────────────────────────────────────────────


async def test_by_analyst_partner_200(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    resp = await client.get("/analytics/by-analyst")
    assert resp.status_code == 200
    assert "items" in resp.json()


async def test_by_analyst_analyst_403(
    client: AsyncClient, mandate: Mandate, partner: User, analyst: User
):
    await _login(client, ANALYST)
    resp = await client.get("/analytics/by-analyst")
    assert resp.status_code == 403


async def test_by_analyst_counts_events(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    c = await _make_company(client, mandate.id, "AnalystTest")
    await _log_event(client, c["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c["id"], "FOLLOW_UP", "2024-01-15")

    resp = await client.get("/analytics/by-analyst")
    partner_row = next(
        (r for r in resp.json()["items"] if r["user_id"] == partner.id), None
    )
    assert partner_row is not None
    assert partner_row["total_events"] >= 2
    assert partner_row["initial_emails"] >= 1


# ── Sources ───────────────────────────────────────────────────────────────────


async def test_sources_endpoint(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    await _make_company(client, mandate.id, "SrcProp")

    resp = await client.get("/analytics/sources")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    row = data["items"][0]
    assert "source" in row
    assert "source_quality" in row
    assert "total" in row
    assert "response_rate" in row


# ── Benchmark ────────────────────────────────────────────────────────────────


async def test_benchmark_endpoint(client: AsyncClient, mandate: Mandate, partner: User):
    await _login(client)
    c1 = await _make_company(client, mandate.id, "Bench1")
    c2 = await _make_company(client, mandate.id, "Bench2")

    # Respond c2 so mandate has a responded company
    await _log_event(client, c2["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c2["id"], "RESPONSE", "2024-01-14")

    # Touch c1 once
    await _log_event(client, c1["id"], "INITIAL_EMAIL", "2024-01-05")

    resp = await client.get(f"/companies/{c1['id']}/benchmark")
    assert resp.status_code == 200
    data = resp.json()
    assert "mandate_response_rate" in data
    assert "mandate_avg_touches_to_response" in data
    assert "mandate_avg_days_to_response" in data
    assert "this_company_touches" in data
    assert data["mandate_response_rate"] > 0.0
    assert data["this_company_touches"] >= 1


async def test_benchmark_not_found(client: AsyncClient, partner: User):
    await _login(client)
    resp = await client.get("/companies/99999/benchmark")
    assert resp.status_code == 404


# ── Response latency (reply-timing) ────────────────────────────────────────────


async def test_response_latency_requires_auth(client: AsyncClient):
    assert (await client.get("/analytics/response-latency")).status_code == 401


async def test_response_latency_empty(client: AsyncClient, mandate: Mandate, partner: User):
    """No responded companies → medians are None, buckets all zero, envelope intact."""
    await _login(client)
    await _make_company(client, mandate.id, "Quiet")

    resp = await client.get("/analytics/response-latency")
    assert resp.status_code == 200
    data = resp.json()
    assert data["responded_total"] == 0
    assert data["days"]["median"] is None
    assert data["touches"]["median"] is None
    assert sum(b["count"] for b in data["days"]["buckets"]) == 0


async def test_response_latency_distribution(client: AsyncClient, mandate: Mandate, partner: User):
    """Two responded companies with known timing → medians + buckets reflect them."""
    await _login(client)
    c1 = await _make_company(client, mandate.id, "Fast")
    c2 = await _make_company(client, mandate.id, "Slow")

    # c1: replied 4 days after 1 email (initial only) → 4d, 1 touch.
    await _log_event(client, c1["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c1["id"], "RESPONSE", "2024-01-05")

    # c2: initial + one follow-up, replied 20 days out → 20d, 2 touches.
    await _log_event(client, c2["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c2["id"], "FOLLOW_UP", "2024-01-10")
    await _log_event(client, c2["id"], "RESPONSE", "2024-01-21")

    resp = await client.get("/analytics/response-latency")
    data = resp.json()
    assert data["responded_total"] == 2
    assert data["days"]["with_data"] == 2
    # Median of {4, 20} = 12.
    assert data["days"]["median"] == 12
    # Median of {1, 2} = 1.5.
    assert data["touches"]["median"] == 1.5

    day_counts = {b["label"]: b["count"] for b in data["days"]["buckets"]}
    assert day_counts["3-6d"] == 1  # c1
    assert day_counts["14-29d"] == 1  # c2
    touch_counts = {b["label"]: b["count"] for b in data["touches"]["buckets"]}
    assert touch_counts["1"] == 1
    assert touch_counts["2"] == 1


async def test_response_latency_analyst_scoped(
    client: AsyncClient, assigned_mandate: Mandate, partner: User, analyst: User
):
    """Analyst sees only their assigned mandate's responded companies."""
    await _login(client)  # partner creates + responds a company on the assigned mandate
    c = await _make_company(client, assigned_mandate.id, "Assigned")
    await _log_event(client, c["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c["id"], "RESPONSE", "2024-01-08")

    await _login(client, ANALYST)
    resp = await client.get("/analytics/response-latency")
    assert resp.status_code == 200
    assert resp.json()["responded_total"] == 1
