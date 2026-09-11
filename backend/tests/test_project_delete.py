"""Permanent project deletion — the only place the delete ordering is really exercised.

This module builds **its own engine with ``PRAGMA foreign_keys=ON``**, because the app's
SQLite does not enforce the foreign keys its tables declare. Without that pragma a
mis-ordered delete succeeds on every developer machine and raises ``ForeignKeyViolation``
only in production, which is precisely the failure this feature must not have.

The pragma lives here rather than in ``conftest.py`` on purpose: turning it on globally
would break fixtures elsewhere that insert children before parents, and a change that
broad does not belong in a feature's test file.

The single most important assertion in the file is that the **sibling project is
untouched**. Everything else is detail.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_session
from app.main import app
from app.models.activity_event import ActivityEvent
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.contact import Contact
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    ImportSource,
    ImportStatus,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
    UserRole,
)
from app.models.firm import Firm
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.task import Task
from app.models.user import User
from app.services.project_delete import _STEPS

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


# ── An engine that actually enforces the foreign keys ─────────────────────────


@pytest_asyncio.fixture
async def fk_engine():
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng.sync_engine, "connect")
    def _fk_on(dbapi_conn, _record):  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def fk_session(fk_engine) -> AsyncSession:
    factory = async_sessionmaker(fk_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def fk_client(fk_session: AsyncSession) -> AsyncClient:
    async def _override():
        yield fk_session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _build_project(db: AsyncSession, firm: Firm, owner: User, name: str) -> dict:
    """One project with a full book beneath it: engagement, company, contact, schedule,
    outreach event, task, activity row, import batch and row."""
    project = Project(
        firm_id=firm.id, name=name, client_name=f"{name} Ltd", created_by_id=owner.id
    )
    db.add(project)
    await db.flush()

    mandate = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name=f"{name} Ltd",
        name=f"{name} Sell-side",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=owner.id,
    )
    db.add(mandate)
    await db.flush()
    db.add(MandateAssignment(mandate_id=mandate.id, user_id=owner.id))

    profile = CompanyProfile(firm_id=firm.id, company_name=f"{name} Target", name_key=f"{name.lower()}target")
    db.add(profile)
    await db.flush()

    company = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        profile_id=profile.id,
        company_name=f"{name} Target",
        type=CompanyType.BUYER,
        status=CompanyStatus.CONTACTED,
        category=CompanyCategory.STRATEGIC,
        source=Source.PROPRIETARY,
        source_quality=SourceQuality.MEDIUM,
    )
    db.add(company)
    await db.flush()

    contact = Contact(firm_id=firm.id, company_id=company.id, contact_person=f"{name} POC")
    schedule = OutreachSchedule(
        firm_id=firm.id,
        company_id=company.id,
        status=ScheduleStatus.ACTIVE,
        cycle_number=1,
        is_current=True,
        cadence_interval_days=7,
        initial_date=date(2026, 1, 1),
    )
    db.add_all([contact, schedule])
    await db.flush()

    db.add(
        OutreachEvent(
            firm_id=firm.id,
            company_id=company.id,
            schedule_id=schedule.id,
            contact_id=contact.id,
            event_type=OutreachEventType.INITIAL_EMAIL,
            occurred_on=date(2026, 1, 1),
            owner_id=owner.id,
        )
    )
    db.add(
        Task(
            firm_id=firm.id,
            project_id=project.id,
            mandate_id=mandate.id,
            company_id=company.id,
            scope="COMPANY",
            title=f"{name} follow-up",
            status="BACKLOG",
            priority="MEDIUM",
            created_by_id=owner.id,
        )
    )
    db.add(
        ActivityEvent(
            firm_id=firm.id,
            project_id=project.id,
            company_id=company.id,
            actor_id=owner.id,
            actor_name=owner.full_name,
            verb="COMPANY_CREATED",
            object_type="COMPANY",
            object_id=company.id,
            object_label=company.company_name,
        )
    )
    db.add(ProjectAssignment(project_id=project.id, user_id=owner.id))

    batch = ImportBatch(
        firm_id=firm.id,
        project_id=project.id,
        source=ImportSource.WORKBOOK,
        filename=f"{name}.xlsx",
        status=ImportStatus.APPLIED,
    )
    db.add(batch)
    await db.flush()
    db.add(
        ImportRow(
            batch_id=batch.id,
            row_index=0,
            raw={"name": company.company_name},
            resolved_company_id=company.id,
            resolved_contact_id=contact.id,
            resolved_schedule_id=schedule.id,
        )
    )
    await db.commit()

    return {
        "project": project,
        "mandate": mandate,
        "company": company,
        "contact": contact,
        "schedule": schedule,
        "profile": profile,
        "batch": batch,
    }


@pytest_asyncio.fixture
async def world(fk_session: AsyncSession) -> dict:
    """A firm with two full projects. The sibling exists to be left alone."""
    firm = Firm(name="Test Firm")
    fk_session.add(firm)
    await fk_session.flush()

    partner = User(
        firm_id=firm.id,
        email=_PARTNER["email"],
        hashed_password=hash_password(_PARTNER["password"]),
        full_name="Test Partner",
        role=UserRole.PARTNER,
    )
    analyst = User(
        firm_id=firm.id,
        email=_ANALYST["email"],
        hashed_password=hash_password(_ANALYST["password"]),
        full_name="Test Analyst",
        role=UserRole.ANALYST,
    )
    fk_session.add_all([partner, analyst])
    await fk_session.commit()

    doomed = await _build_project(fk_session, firm, analyst, "Doomed")
    sibling = await _build_project(fk_session, firm, partner, "Sibling")

    # A CSV batch owned by nobody's project, holding a row that points into the doomed
    # project. Its audit trail must survive with the pointers nulled.
    csv_batch = ImportBatch(
        firm_id=firm.id,
        project_id=None,
        source=ImportSource.CSV,
        filename="pool.csv",
        status=ImportStatus.APPLIED,
    )
    fk_session.add(csv_batch)
    await fk_session.flush()
    csv_row = ImportRow(
        batch_id=csv_batch.id,
        row_index=0,
        raw={"name": "Doomed Target"},
        resolved_company_id=doomed["company"].id,
    )
    fk_session.add(csv_row)
    await fk_session.commit()

    return {
        "firm": firm,
        "partner": partner,
        "analyst": analyst,
        "doomed": doomed,
        "sibling": sibling,
        "csv_batch": csv_batch,
        "csv_row": csv_row,
    }


async def _archive(client: AsyncClient, project_id: int) -> None:
    r = await client.delete(f"/projects/{project_id}")
    assert r.status_code == 200, r.text


# ── The rails ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refuses_a_project_that_is_not_archived(fk_client: AsyncClient, world: dict):
    """Rail 1, the best of them: delete is only reachable as a deliberate second step."""
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    r = await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_wrong_name_is_422_and_quotes_the_expected_one(
    fk_client: AsyncClient, world: dict
):
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    await _archive(fk_client, pid)
    r = await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "doomed"}
    )
    assert r.status_code == 422
    assert "Doomed" in r.json()["detail"]


@pytest.mark.asyncio
async def test_preview_counts_what_will_die(fk_client: AsyncClient, world: dict):
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    body = (await fk_client.get(f"/projects/{pid}/deletion-preview")).json()
    counts = body["counts"]
    assert counts["companies"] == 1
    assert counts["contacts"] == 1
    assert counts["outreach_events"] == 1
    assert counts["tasks"] == 1
    assert counts["mandates"] == 1
    assert counts["projects"] == 1
    assert body["total"] == sum(counts.values())
    assert any("company_profiles" in k for k in body["kept"])


# ── The delete itself ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_removes_the_book_and_leaves_the_sibling_untouched(
    fk_client: AsyncClient, fk_session: AsyncSession, world: dict
):
    """The single most important assertion in this file is the sibling half."""
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    await _archive(fk_client, pid)

    r = await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )
    assert r.status_code == 200, r.text
    counts = r.json()["counts"]

    # Every table the fixture populated reports a non-zero delete. Without this, a
    # silently-empty scope subquery would look like a clean run.
    for table in (
        "companies",
        "contacts",
        "outreach_events",
        "outreach_schedules",
        "tasks",
        "activity_events",
        "mandates",
        "mandate_assignments",
        "project_assignments",
        "import_batches",
        "import_rows",
        "projects",
    ):
        assert counts[table] >= 1, f"{table} reported {counts[table]}"

    async def _count(model, where) -> int:
        return (
            await fk_session.execute(select(func.count()).select_from(model).where(where))
        ).scalar() or 0

    doomed_mandate = world["doomed"]["mandate"].id
    assert await _count(Project, Project.id == pid) == 0
    assert await _count(Mandate, Mandate.project_id == pid) == 0
    assert await _count(Company, Company.mandate_id == doomed_mandate) == 0

    # The sibling still has all of it.
    sib = world["sibling"]
    assert await _count(Project, Project.id == sib["project"].id) == 1
    assert await _count(Mandate, Mandate.id == sib["mandate"].id) == 1
    assert await _count(Company, Company.id == sib["company"].id) == 1
    assert await _count(Contact, Contact.id == sib["contact"].id) == 1
    assert await _count(OutreachEvent, OutreachEvent.company_id == sib["company"].id) == 1
    assert await _count(Task, Task.project_id == sib["project"].id) == 1


@pytest.mark.asyncio
async def test_company_profiles_survive(
    fk_client: AsyncClient, fk_session: AsyncSession, world: dict
):
    """The database tier outlives even a workspace reset, so it certainly outlives this."""
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    profile_id = world["doomed"]["profile"].id
    await _archive(fk_client, pid)
    await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )

    remaining = (
        await fk_session.execute(
            select(func.count()).select_from(CompanyProfile).where(CompanyProfile.id == profile_id)
        )
    ).scalar()
    assert remaining == 1


@pytest.mark.asyncio
async def test_foreign_batch_keeps_its_row_with_the_pointer_nulled(
    fk_client: AsyncClient, fk_session: AsyncSession, world: dict
):
    """The import_rows trap: a CSV batch's audit trail is not this project's to destroy."""
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    csv_row_id = world["csv_row"].id
    csv_batch_id = world["csv_batch"].id
    await _archive(fk_client, pid)
    await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )

    row = (
        await fk_session.execute(select(ImportRow).where(ImportRow.id == csv_row_id))
    ).scalar_one_or_none()
    assert row is not None, "another batch's row must survive"
    assert row.resolved_company_id is None, "the dangling pointer must be nulled"

    batch = (
        await fk_session.execute(select(ImportBatch).where(ImportBatch.id == csv_batch_id))
    ).scalar_one_or_none()
    assert batch is not None


@pytest.mark.asyncio
async def test_tombstone_survives_with_a_null_project_id(
    fk_client: AsyncClient, fk_session: AsyncSession, world: dict
):
    """Written after the loop. Written before, step 4 would delete it."""
    await _login(fk_client, _PARTNER)
    pid = world["doomed"]["project"].id
    await _archive(fk_client, pid)
    await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )

    tombstone = (
        await fk_session.execute(
            select(ActivityEvent).where(ActivityEvent.verb == "PROJECT_DELETED")
        )
    ).scalar_one()
    assert tombstone.project_id is None
    assert tombstone.object_label == "Doomed"
    assert tombstone.meta["project_id"] == pid
    assert tombstone.meta["name"] == "Doomed"
    assert tombstone.meta["counts"]["companies"] == 1


@pytest.mark.asyncio
async def test_an_analyst_who_can_see_the_project_CAN_delete_it(
    fk_client: AsyncClient, world: dict
):
    """No role gate — asserted explicitly so nobody later "fixes" it into a partner gate.

    That was a deliberate product decision. If this test starts failing because someone
    added ``PartnerDep``, the decision is what needs revisiting, not the assertion.
    """
    await _login(fk_client, _ANALYST)
    pid = world["doomed"]["project"].id
    await _archive(fk_client, pid)
    r = await fk_client.post(
        f"/projects/{pid}/permanent-delete", json={"confirm_project_name": "Doomed"}
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_an_analyst_cannot_delete_a_project_they_cannot_see(
    fk_client: AsyncClient, world: dict
):
    await _login(fk_client, _PARTNER)
    sibling_id = world["sibling"]["project"].id
    await _archive(fk_client, sibling_id)

    await _login(fk_client, _ANALYST)
    r = await fk_client.post(
        f"/projects/{sibling_id}/permanent-delete",
        json={"confirm_project_name": "Sibling"},
    )
    assert r.status_code == 404


# ── The ordering itself ───────────────────────────────────────────────────────


def test_step_order_puts_every_child_before_its_parent():
    """A static read of the ordering, so a reviewer can check it without running SQL."""
    order = [name for name, _ in _STEPS]
    for child, parent in (
        ("sent_emails", "companies"),
        ("import_rows", "import_batches"),
        ("activity_events", "companies"),
        ("activity_events", "projects"),
        ("tasks", "companies"),
        ("tasks", "projects"),
        ("outreach_events", "outreach_schedules"),
        ("outreach_events", "companies"),
        ("outreach_schedules", "companies"),
        ("contacts", "companies"),
        ("sourcing_candidates", "companies"),
        ("companies", "sourcing_layers"),
        ("companies", "mandates"),
        ("mandate_assignments", "mandates"),
        ("project_assignments", "projects"),
        ("mandates", "projects"),
    ):
        assert order.index(child) < order.index(parent), f"{child} must precede {parent}"


def test_projects_is_the_last_step():
    assert _STEPS[-1][0] == "projects"
