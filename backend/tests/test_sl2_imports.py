"""SL-2 — CSV / IB-DB pool ingest: preview, validate (dry-run dedup), idempotent apply."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_profile import CompanyProfile
from app.services.imports import parse_csv, row_to_facts, suggest_mapping

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}

CSV = (
    "Company Name,Website,HQ,Headcount,Revenue (INR Cr)\n"
    "Acme Manufacturing Pvt Ltd,acme.com,Mumbai,1200,850.5\n"
    "Beta Foods Ltd,betafoods.in,Delhi,300,120\n"
    "Acme Manufacturing,https://www.acme.com,Mumbai,,\n"  # intra-file dup by domain
    ",noname.com,Pune,50,10\n"  # error: missing company_name
)


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _preview(client: AsyncClient, text: str = CSV) -> dict:
    resp = await client.post(
        "/imports/csv/preview",
        files={"file": ("targets.csv", text.encode(), "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Unit-level parsing / mapping ──────────────────────────────────────────────


def test_parse_and_suggest_mapping():
    headers, rows = parse_csv(CSV)
    assert headers == ["Company Name", "Website", "HQ", "Headcount", "Revenue (INR Cr)"]
    assert len(rows) == 4
    mapping = suggest_mapping(headers)
    assert mapping["company_name"] == "Company Name"
    assert mapping["website"] == "Website"
    assert mapping["headcount"] == "Headcount"
    assert mapping["revenue_inr_cr"] == "Revenue (INR Cr)"


def test_row_to_facts_coerces_and_flags_missing_name():
    mapping = {"company_name": "Company Name", "headcount": "Headcount"}
    facts, errors = row_to_facts({"Company Name": "X", "Headcount": "1,200"}, mapping)
    assert facts["headcount"] == 1200
    assert errors == []
    _, errs = row_to_facts({"Company Name": "", "Headcount": "5"}, mapping)
    assert any("company_name" in e for e in errs)


# ── Preview / suggested mapping ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_preview_returns_headers_and_mapping(client: AsyncClient, partner):
    await _login(client, PARTNER)
    data = await _preview(client)
    assert data["row_count"] == 4
    assert data["suggested_mapping"]["company_name"] == "Company Name"
    assert len(data["sample_rows"]) == 4


@pytest.mark.asyncio
async def test_validate_dedup_preview_counts(client: AsyncClient, partner):
    await _login(client, PARTNER)
    data = await _preview(client)
    mapping = data["suggested_mapping"]
    resp = await client.post(
        "/imports/csv/validate", json={"batch_id": data["batch_id"], "mapping": mapping}
    )
    assert resp.status_code == 200
    preview = resp.json()
    # 2 new (Acme, Beta), 1 intra-file merge (Acme dup), 1 error (missing name).
    assert preview["counts"]["create"] == 2
    assert preview["counts"]["update"] == 1
    assert preview["counts"]["error"] == 1
    assert len(preview["clusters"]) == 1


@pytest.mark.asyncio
async def test_validate_writes_no_profiles(client: AsyncClient, partner, db_session):
    await _login(client, PARTNER)
    data = await _preview(client)
    await client.post(
        "/imports/csv/validate",
        json={"batch_id": data["batch_id"], "mapping": data["suggested_mapping"]},
    )
    count = (await db_session.execute(select(func.count()).select_from(CompanyProfile))).scalar()
    assert count == 0  # dry-run wrote nothing


@pytest.mark.asyncio
async def test_apply_is_idempotent(client: AsyncClient, partner, db_session: AsyncSession):
    await _login(client, PARTNER)

    # First import.
    d1 = await _preview(client)
    r1 = await client.post(
        "/imports/csv/apply", json={"batch_id": d1["batch_id"], "mapping": d1["suggested_mapping"]}
    )
    assert r1.status_code == 200
    body1 = r1.json()
    assert body1["created"] == 2  # Acme + Beta
    assert body1["skipped"] == 1  # missing-name error row

    count_after_first = (
        await db_session.execute(select(func.count()).select_from(CompanyProfile))
    ).scalar()
    assert count_after_first == 2

    # Second import of the SAME file → all updates, 0 new profiles.
    d2 = await _preview(client)
    r2 = await client.post(
        "/imports/csv/apply", json={"batch_id": d2["batch_id"], "mapping": d2["suggested_mapping"]}
    )
    body2 = r2.json()
    assert body2["created"] == 0
    # All 3 data rows now resolve to the 2 existing profiles (Acme appears twice).
    assert body2["updated"] == 3

    count_after_second = (
        await db_session.execute(select(func.count()).select_from(CompanyProfile))
    ).scalar()
    assert count_after_second == 2  # no duplicates


@pytest.mark.asyncio
async def test_reapply_same_batch_is_noop(client: AsyncClient, partner):
    await _login(client, PARTNER)
    d = await _preview(client)
    await client.post(
        "/imports/csv/apply", json={"batch_id": d["batch_id"], "mapping": d["suggested_mapping"]}
    )
    r = await client.post(
        "/imports/csv/apply", json={"batch_id": d["batch_id"], "mapping": d["suggested_mapping"]}
    )
    assert r.json()["already_applied"] is True


@pytest.mark.asyncio
async def test_error_rows_download(client: AsyncClient, partner):
    await _login(client, PARTNER)
    d = await _preview(client)
    await client.post(
        "/imports/csv/apply", json={"batch_id": d["batch_id"], "mapping": d["suggested_mapping"]}
    )
    resp = await client.get(f"/imports/{d['batch_id']}/errors.csv")
    assert resp.status_code == 200
    assert "_error" in resp.text


@pytest.mark.asyncio
async def test_batch_firm_scoping(client: AsyncClient, partner, db_session):
    """A batch from another firm is 404 (not leaked)."""
    await _login(client, PARTNER)
    d = await _preview(client)
    # Move the batch to a different firm.
    from app.models.import_batch import ImportBatch

    batch = (
        await db_session.execute(select(ImportBatch).where(ImportBatch.id == d["batch_id"]))
    ).scalar_one()
    batch.firm_id = 99999
    await db_session.commit()
    resp = await client.get(f"/imports/{d['batch_id']}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_ib_db_one_shot(client: AsyncClient, partner, db_session):
    await _login(client, PARTNER)
    resp = await client.post(
        "/imports/ib-db",
        files={"file": ("ibdb.csv", CSV.encode(), "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "APPLIED"
    assert body["created"] == 2


@pytest.mark.asyncio
async def test_ib_db_partner_only(client: AsyncClient, analyst):
    await _login(client, ANALYST)
    resp = await client.post(
        "/imports/ib-db", files={"file": ("ibdb.csv", CSV.encode(), "text/csv")}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_template_download(client: AsyncClient, partner):
    await _login(client, PARTNER)
    resp = await client.get("/imports/template.csv")
    assert resp.status_code == 200
    assert "Company name" in resp.text
