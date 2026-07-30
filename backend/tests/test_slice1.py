"""Slice-1 acceptance tests — schema foundation, cadence multi-cycle, category, project scoping.

Covers:
- Project model: create, firm-scoping, mandate relationship
- CompanyCategory: create, update, list-filter
- StoppedReason.EXHAUSTED is a valid enum value
- Multi-cycle invariants: two schedules, exactly one is_current per company
- log_event hits current cycle only (no MultipleResultsFound on restarted companies)
- Summary counts only current-cycle schedules (no double-count)
- Benchmark scoped to current cycle (A2)
- Firm.follow_up_cap default = 4
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.company import Company
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
    StoppedReason,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.user import User

# These match conftest.py's partner/analyst fixtures.
_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _make_company(
    client: AsyncClient,
    mandate_id: int,
    name: str = "TestCo",
    **extra,
) -> dict:
    payload = {"company_name": name, "mandate_id": mandate_id, "type": "TARGET", **extra}
    r = await client.post("/companies", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ── Project model (ORM-level, no HTTP) ───────────────────────────────────────


@pytest_asyncio.fixture
async def s1_project(db_session: AsyncSession, firm: Firm) -> Project:
    """A Project row in the existing test firm (reuses conftest 'firm')."""
    p = Project(firm_id=firm.id, name="Medanta Project", client_name="Medanta Healthcare")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def s1_mandate_with_project(
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    s1_project: Project,
) -> Mandate:
    """Mandate explicitly linked to s1_project."""
    m = Mandate(
        firm_id=firm.id,
        project_id=s1_project.id,
        client_name="Medanta Healthcare",
        name="Pharma Consolidation",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


@pytest.mark.asyncio
async def test_project_firm_scoping(db_session: AsyncSession, firm: Firm, s1_project: Project):
    """Project row is scoped to the firm that created it."""
    result = await db_session.execute(
        select(Project).where(Project.firm_id == firm.id)
    )
    rows = result.scalars().all()
    assert len(rows) == 1
    assert rows[0].client_name == "Medanta Healthcare"


@pytest.mark.asyncio
async def test_project_mandate_relationship(
    db_session: AsyncSession,
    s1_project: Project,
    s1_mandate_with_project: Mandate,
):
    """Mandate.project_id points at the project; Project.mandates includes the mandate."""
    await db_session.refresh(s1_project, attribute_names=["mandates"])
    assert s1_mandate_with_project.project_id == s1_project.id
    assert s1_mandate_with_project.id in [m.id for m in s1_project.mandates]


@pytest.mark.asyncio
async def test_firm_follow_up_cap_default(db_session: AsyncSession, firm: Firm):
    """Firm.follow_up_cap column exists and defaults to 4."""
    await db_session.refresh(firm)
    # The test firm is created without follow_up_cap; the model default is 4.
    assert firm.follow_up_cap == 4


# ── StoppedReason.EXHAUSTED ───────────────────────────────────────────────────


def test_stopped_reason_exhausted_enum():
    """EXHAUSTED is a valid StoppedReason value."""
    assert StoppedReason.EXHAUSTED.value == "EXHAUSTED"
    assert StoppedReason.EXHAUSTED in list(StoppedReason)


# ── CompanyCategory (HTTP) ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_company_category_defaults_to_other(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    """Creating a company without category defaults to OTHER."""
    await _login(client, _PARTNER)
    data = await _make_company(client, assigned_mandate.id, "CategoryDefault Co")
    assert data["category"] == CompanyCategory.OTHER.value


@pytest.mark.asyncio
async def test_company_category_set_on_create(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    """category field is persisted and returned correctly on create."""
    await _login(client, _PARTNER)
    data = await _make_company(
        client,
        assigned_mandate.id,
        "PE Target Co",
        category=CompanyCategory.PRIVATE_EQUITY.value,
    )
    assert data["category"] == CompanyCategory.PRIVATE_EQUITY.value


@pytest.mark.asyncio
async def test_company_category_filter(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    """GET /companies?category= filters by CompanyCategory correctly."""
    await _login(client, _PARTNER)
    await _make_company(
        client, assigned_mandate.id, "Strategic Target",
        category=CompanyCategory.STRATEGIC.value,
    )
    await _make_company(
        client, assigned_mandate.id, "PE Fund",
        category=CompanyCategory.PRIVATE_EQUITY.value,
    )

    r = await client.get(f"/companies?category={CompanyCategory.STRATEGIC.value}")
    assert r.status_code == 200
    names = [item["company_name"] for item in r.json()["items"]]
    assert "Strategic Target" in names
    assert "PE Fund" not in names


@pytest.mark.asyncio
async def test_company_category_update(
    client: AsyncClient, partner: User, assigned_mandate: Mandate
):
    """PATCH /companies/{id} updates the category."""
    await _login(client, _PARTNER)
    created = await _make_company(client, assigned_mandate.id, "Reclassify Me")
    r = await client.patch(
        f"/companies/{created['id']}",
        json={"category": CompanyCategory.VENTURE_CAPITAL.value},
    )
    assert r.status_code == 200
    assert r.json()["category"] == CompanyCategory.VENTURE_CAPITAL.value


# ── Multi-cycle invariants (ORM-level) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_company_can_have_two_cycles(
    db_session: AsyncSession,
    firm: Firm,
    mandate: Mandate,
):
    """A company may have 2 OutreachSchedule rows; exactly one must be is_current."""
    company = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        company_name="Two Cycle Corp",
        type=CompanyType.TARGET,
        status=CompanyStatus.NOT_CONTACTED,
        category=CompanyCategory.STRATEGIC,
        source=Source.PROPRIETARY,
        source_quality=SourceQuality.MEDIUM,
    )
    db_session.add(company)
    await db_session.flush()

    sched1 = OutreachSchedule(
        firm_id=firm.id, company_id=company.id,
        cycle_number=1, is_current=False,
        status=ScheduleStatus.STOPPED, stopped_reason=StoppedReason.EXHAUSTED,
    )
    sched2 = OutreachSchedule(
        firm_id=firm.id, company_id=company.id,
        cycle_number=2, is_current=True,
        status=ScheduleStatus.AWAITING_INITIAL,
    )
    db_session.add_all([sched1, sched2])
    await db_session.commit()

    result = await db_session.execute(
        select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
    )
    all_scheds = result.scalars().all()
    assert len(all_scheds) == 2

    current = [s for s in all_scheds if s.is_current]
    assert len(current) == 1
    assert current[0].cycle_number == 2
    assert current[0].status == ScheduleStatus.AWAITING_INITIAL


# ── log_event hits current cycle only (HTTP) ─────────────────────────────────


@pytest.mark.asyncio
async def test_log_event_targets_current_cycle(
    client: AsyncClient,
    db_session: AsyncSession,
    partner: User,
    firm: Firm,
    assigned_mandate: Mandate,
):
    """Logging an event on a 2-cycle company must write to cycle 2 — no MultipleResultsFound."""
    await _login(client, _PARTNER)
    data = await _make_company(client, assigned_mandate.id, "Restart Test Corp")
    company_id = data["id"]

    # Demote the auto-created is_current schedule to cycle 1 / exhausted
    result = await db_session.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched1 = result.scalar_one()
    sched1.cycle_number = 1
    sched1.is_current = False
    sched1.status = ScheduleStatus.STOPPED
    sched1.stopped_reason = StoppedReason.EXHAUSTED

    # Fresh cycle 2 — current
    sched2 = OutreachSchedule(
        firm_id=firm.id, company_id=company_id,
        cycle_number=2, is_current=True,
        status=ScheduleStatus.AWAITING_INITIAL,
    )
    db_session.add(sched2)
    await db_session.commit()
    await db_session.refresh(sched2)

    r = await client.post(
        f"/companies/{company_id}/events",
        json={
            "event_type": OutreachEventType.INITIAL_EMAIL.value,
            "occurred_on": date.today().isoformat(),
        },
    )
    assert r.status_code == 201, r.text

    # Event must land on cycle 2
    ev_result = await db_session.execute(
        select(OutreachEvent).where(OutreachEvent.company_id == company_id)
    )
    events = ev_result.scalars().all()
    assert len(events) == 1
    assert events[0].schedule_id == sched2.id


# ── Summary double-count guard (A3) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_summary_counts_only_current_cycle(
    client: AsyncClient,
    db_session: AsyncSession,
    partner: User,
    firm: Firm,
    assigned_mandate: Mandate,
):
    """needs_initial_count must not double-count a company that has 2 AWAITING schedules."""
    await _login(client, _PARTNER)
    data = await _make_company(client, assigned_mandate.id, "DoubleCycle Co")
    company_id = data["id"]

    # Add an archived (non-current) AWAITING schedule alongside the auto-created current one
    ghost = OutreachSchedule(
        firm_id=firm.id, company_id=company_id,
        cycle_number=0, is_current=False,
        status=ScheduleStatus.AWAITING_INITIAL,
    )
    db_session.add(ghost)
    await db_session.commit()

    r = await client.get(f"/companies?mandate_id={assigned_mandate.id}")
    assert r.status_code == 200
    # Only the is_current=True schedule should count; needs_initial_count = 1, not 2
    assert r.json()["summary"]["needs_initial_count"] == 1


# ── Benchmark current-cycle scoping (A2) ─────────────────────────────────────


@pytest.mark.asyncio
async def test_benchmark_scoped_to_current_cycle(
    client: AsyncClient,
    db_session: AsyncSession,
    partner: User,
    firm: Firm,
    assigned_mandate: Mandate,
):
    """Benchmark this_company_touches must only count events in the current cycle."""
    await _login(client, _PARTNER)
    data = await _make_company(client, assigned_mandate.id, "BenchmarkCo")
    company_id = data["id"]

    # Demote auto-created schedule to exhausted cycle 1
    result = await db_session.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched1 = result.scalar_one()
    sched1.is_current = False
    sched1.status = ScheduleStatus.STOPPED
    sched1.stopped_reason = StoppedReason.EXHAUSTED

    # 3 old-cycle events that must NOT count
    for i in range(3):
        db_session.add(OutreachEvent(
            firm_id=firm.id, company_id=company_id, schedule_id=sched1.id,
            event_type=OutreachEventType.FOLLOW_UP,
            occurred_on=date(2024, 1, i + 1),
            owner_id=partner.id,
        ))

    # Cycle 2 — current, 1 touch
    sched2 = OutreachSchedule(
        firm_id=firm.id, company_id=company_id,
        cycle_number=2, is_current=True,
        status=ScheduleStatus.ACTIVE,
        initial_date=date(2025, 1, 1),
    )
    db_session.add(sched2)
    await db_session.flush()
    db_session.add(OutreachEvent(
        firm_id=firm.id, company_id=company_id, schedule_id=sched2.id,
        event_type=OutreachEventType.INITIAL_EMAIL,
        occurred_on=date(2025, 1, 1),
        owner_id=partner.id,
    ))
    await db_session.commit()

    r = await client.get(f"/companies/{company_id}/benchmark")
    assert r.status_code == 200
    # Only 1 touch (cycle 2), not 4 (3 old + 1)
    assert r.json()["this_company_touches"] == 1
