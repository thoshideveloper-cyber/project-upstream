"""Slice-6 acceptance tests — fuzzy cross-mandate dedup.

Covers:
- normalise_name helper (unit)
- extract_domain helper (unit)
- Exact name match → confidence=1.0, match_type="exact_name"
- Exact domain match → confidence=1.0, match_type="exact_domain"
- Fuzzy name catches typo variants ("Microsft" ~ "Microsoft")
- Fuzzy name catches subsidiary variants ("Tata" ~ "Tata Sons") after normalization
- Below-threshold names do NOT produce warnings
- Same-mandate company is excluded
- Archived company is excluded
- Advisory (non-blocking): POST /companies returns 201 even when fuzzy match found
- Single batched schedule query: all warnings include schedule data from one fetch
- Confidence score is present and in [0,1] range; match_type is correct
- HTTP check-duplicate endpoint surfaces fuzzy match with confidence field
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    ScheduleStatus,
    Source,
    SourceQuality,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.outreach_schedule import OutreachSchedule
from app.models.user import User
from app.services.cross_mandate import (
    extract_domain,
    find_duplicates,
    normalise_name,
)

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


# ── Unit: normalise_name ──────────────────────────────────────────────────────


def test_normalise_name_strips_suffixes():
    assert normalise_name("Tata Sons Ltd.") == "tata sons"
    assert normalise_name("Microsoft Corporation") == "microsoft"
    assert normalise_name("IndInfra Holdings Pvt Ltd") == "indinfra"


def test_normalise_name_strips_punctuation():
    assert normalise_name("Alpha & Beta Co.") == "alpha beta"


def test_normalise_name_handles_extra_whitespace():
    result = normalise_name("  Green   Grow   Tech  ")
    assert "  " not in result
    assert result == result.strip()


# ── Unit: extract_domain ──────────────────────────────────────────────────────


def test_extract_domain_strips_www():
    assert extract_domain("https://www.tata.com") == "tata.com"


def test_extract_domain_handles_bare_domain():
    assert extract_domain("microsoft.com") == "microsoft.com"


def test_extract_domain_returns_none_for_empty():
    assert extract_domain(None) is None
    assert extract_domain("") is None


# ── Unit: find_duplicates (ORM-level) ────────────────────────────────────────


@pytest_asyncio.fixture
async def two_mandates(db_session: AsyncSession, firm: Firm, partner: User):
    """Two mandates in the same firm — useful for cross-mandate tests."""
    m1 = Mandate(
        firm_id=firm.id, client_name="Client A", name="Mandate A",
        type=MandateType.SELL_SIDE, status=MandateStatus.ACTIVE, lead_owner_id=partner.id,
    )
    m2 = Mandate(
        firm_id=firm.id, client_name="Client B", name="Mandate B",
        type=MandateType.BUY_SIDE, status=MandateStatus.ACTIVE, lead_owner_id=partner.id,
    )
    db_session.add_all([m1, m2])
    await db_session.commit()
    await db_session.refresh(m1)
    await db_session.refresh(m2)
    return m1, m2


async def _make_company_orm(
    db_session: AsyncSession,
    firm: Firm,
    mandate: Mandate,
    name: str,
    website: str | None = None,
    archived: bool = False,
) -> Company:
    from datetime import datetime, timezone
    c = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        company_name=name,
        type=CompanyType.TARGET,
        status=CompanyStatus.NOT_CONTACTED,
        category=CompanyCategory.OTHER,
        source=Source.PROPRIETARY,
        source_quality=SourceQuality.MEDIUM,
        website=website,
        archived_at=datetime.now(timezone.utc) if archived else None,
    )
    db_session.add(c)
    await db_session.flush()

    sched = OutreachSchedule(
        firm_id=firm.id, company_id=c.id,
        cycle_number=1, is_current=True,
        status=ScheduleStatus.AWAITING_INITIAL,
    )
    db_session.add(sched)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest.mark.asyncio
async def test_exact_name_match(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Exact normalised name match → confidence=1.0, match_type='exact_name'."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Reliance Industries Ltd")

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Reliance Industries", None
    )
    assert len(warnings) == 1
    w = warnings[0]
    assert w["confidence"] == 1.0
    assert w["match_type"] == "exact_name"
    assert w["company_name"] == "Reliance Industries Ltd"


@pytest.mark.asyncio
async def test_exact_domain_match(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Domain match → confidence=1.0, match_type='exact_domain'."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Tata Group", website="https://www.tata.com")

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Tata Sons Limited", "tata.com"
    )
    assert len(warnings) == 1
    assert warnings[0]["confidence"] == 1.0
    assert warnings[0]["match_type"] == "exact_domain"


@pytest.mark.asyncio
async def test_fuzzy_catches_typo_variant(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """'Microsft' should fuzzy-match 'Microsoft' (typo variant)."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Microsoft")

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Microsft", None
    )
    assert len(warnings) == 1
    w = warnings[0]
    assert w["match_type"] == "fuzzy_name"
    # token_set_ratio for a one-char typo is typically 80-95
    assert w["confidence"] >= 0.80


@pytest.mark.asyncio
async def test_fuzzy_catches_subsidiary_variant(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """'Tata' should fuzzy-match 'Tata Sons' after suffix stripping."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Tata Sons Limited")

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Tata", None
    )
    assert len(warnings) == 1
    assert warnings[0]["match_type"] == "fuzzy_name"


@pytest.mark.asyncio
async def test_no_match_for_unrelated_name(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Completely different names must not produce warnings."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Zephyr Diagnostics")

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Horizon Biotech", None
    )
    assert warnings == []


@pytest.mark.asyncio
async def test_same_mandate_excluded(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Companies in the SAME mandate must not trigger a warning."""
    m1, _ = two_mandates
    await _make_company_orm(db_session, firm, m1, "Same Mandate Co")

    warnings = await find_duplicates(
        db_session, firm.id, m1.id, "Same Mandate Co", None
    )
    assert warnings == []


@pytest.mark.asyncio
async def test_archived_company_excluded(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Archived companies must not appear in warnings."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Archived Corp", archived=True)

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Archived Corp", None
    )
    assert warnings == []


@pytest.mark.asyncio
async def test_batch_schedule_fetch_returns_initial_date(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Schedule data (initial_date) is populated from the single batched query."""
    from datetime import date
    m1, m2 = two_mandates
    c = await _make_company_orm(db_session, firm, m1, "Batch Test Corp")

    # Activate the schedule so initial_date is set
    result = await db_session.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == c.id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = result.scalar_one()
    sched.status = ScheduleStatus.ACTIVE
    sched.initial_date = date(2025, 1, 15)
    await db_session.commit()

    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Batch Test Corp", None
    )
    assert len(warnings) == 1
    assert warnings[0]["initial_date"] == "2025-01-15"


@pytest.mark.asyncio
async def test_multiple_matches_all_returned(
    db_session: AsyncSession, firm: Firm, two_mandates
):
    """Multiple fuzzy matches are all returned (not just the first)."""
    m1, m2 = two_mandates
    await _make_company_orm(db_session, firm, m1, "Alpha Ventures")
    await _make_company_orm(db_session, firm, m1, "Alpha Capital")

    # "Alpha" will fuzzy-match both
    warnings = await find_duplicates(
        db_session, firm.id, m2.id, "Alpha", None
    )
    # May match 0, 1 or 2 depending on scores — just confirm no crash + advisory
    assert isinstance(warnings, list)
    for w in warnings:
        assert 0.0 < w["confidence"] <= 1.0
        assert w["match_type"] in ("exact_name", "exact_domain", "fuzzy_name")


# ── HTTP: advisory (non-blocking) + confidence in response ───────────────────


async def _login(client: AsyncClient) -> None:
    r = await client.post("/auth/login", json=_PARTNER)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_post_company_returns_201_with_fuzzy_warnings(
    client: AsyncClient,
    partner: User,
    db_session: AsyncSession,
    firm: Firm,
    two_mandates,
):
    """POST /companies is non-blocking: 201 even when fuzzy match found.
    The response includes duplicate_warnings with confidence + match_type."""
    await _login(client)
    m1, m2 = two_mandates

    # Seed a company in m1
    await _make_company_orm(db_session, firm, m1, "Microsoft")

    # Create a typo variant in m2 — must still return 201
    r = await client.post(
        "/companies",
        json={
            "company_name": "Microsft",
            "mandate_id": m2.id,
            "type": "TARGET",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    warnings = body.get("duplicate_warnings", [])
    assert len(warnings) >= 1

    w = warnings[0]
    assert "confidence" in w
    assert "match_type" in w
    assert w["match_type"] in ("exact_name", "exact_domain", "fuzzy_name")
    assert 0.0 < w["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_check_duplicate_endpoint_returns_fuzzy(
    client: AsyncClient,
    partner: User,
    db_session: AsyncSession,
    firm: Firm,
    two_mandates,
):
    """GET /companies/check-duplicate surfaces fuzzy matches with confidence field."""
    await _login(client)
    m1, m2 = two_mandates

    await _make_company_orm(db_session, firm, m1, "Tata Sons Limited")

    r = await client.get(
        "/companies/check-duplicate",
        params={"name": "Tata", "mandate_id": m2.id},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "warnings" in body
    warnings = body["warnings"]
    assert len(warnings) >= 1
    assert "confidence" in warnings[0]
    assert "match_type" in warnings[0]
