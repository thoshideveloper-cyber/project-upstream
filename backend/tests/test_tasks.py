"""Tasks API — scope derivation, the status walk, and both halves of the edit rule.

The RBAC assertions here are the point of the file. Tasks are the first thing in the app
that two people share and either may move, so "who may do what" is genuinely asymmetric:
status is open to anyone who can see the task, everything else is not, and PERSONAL tasks
are outside both rules even for a partner.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.time import today_ist
from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    Source,
    SourceQuality,
    TaskStatus,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.mandate import MandateUpdate

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}
_ANALYST_B = {"email": "analyst.b@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


@pytest_asyncio.fixture
async def book(db_session: AsyncSession, firm: Firm, partner: User, analyst: User) -> dict:
    """A project with one engagement, one company and one contact, assigned to the analyst."""
    project = Project(
        firm_id=firm.id, name="Project Alpha", client_name="Alpha", created_by_id=partner.id
    )
    db_session.add(project)
    await db_session.flush()

    mandate = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name="Alpha",
        name="Alpha Sell-side",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(mandate)
    await db_session.flush()

    company = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        company_name="Acme Industries",
        type=CompanyType.BUYER,
        status=CompanyStatus.NOT_CONTACTED,
        category=CompanyCategory.STRATEGIC,
        source=Source.PROPRIETARY,
        source_quality=SourceQuality.MEDIUM,
    )
    db_session.add(company)
    await db_session.flush()

    contact = Contact(
        firm_id=firm.id, company_id=company.id, contact_person="Rhea Kapoor"
    )
    db_session.add(contact)
    db_session.add(MandateAssignment(mandate_id=mandate.id, user_id=analyst.id))
    await db_session.commit()

    return {
        "project_id": project.id,
        "mandate_id": mandate.id,
        "company_id": company.id,
        "contact_id": contact.id,
    }


@pytest_asyncio.fixture
async def analyst_b(db_session: AsyncSession, firm: Firm) -> User:
    u = User(
        firm_id=firm.id,
        email=_ANALYST_B["email"],
        hashed_password=hash_password(_ANALYST_B["password"]),
        full_name="Second Analyst",
        role=UserRole.ANALYST,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


# ── Scope derivation ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "attach_key,expected_scope",
    [
        ("project_id", "PROJECT"),
        ("mandate_id", "MANDATE"),
        ("company_id", "COMPANY"),
        ("contact_id", "CONTACT"),
    ],
)
async def test_every_scope_derives_the_project(
    client: AsyncClient, book: dict, partner: User, attach_key: str, expected_scope: str
):
    """Whatever you attach to, the row lands with the right project_id.

    That denormalised project_id is what makes the sidebar counts one GROUP BY and the
    delete cascade one predicate, so it has to be right from every entry point.
    """
    await _login(client, _PARTNER)
    r = await client.post(
        "/tasks", json={"title": "Chase the NDA", attach_key: book[attach_key]}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["scope"] == expected_scope
    assert body["project_id"] == book["project_id"]
    assert body["attached_to"]["type"] == expected_scope


@pytest.mark.asyncio
async def test_no_attachment_is_a_personal_task(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    r = await client.post("/tasks", json={"title": "Read the CIM"})
    assert r.status_code == 201
    body = r.json()
    assert body["scope"] == "PERSONAL"
    assert body["project_id"] is None
    assert body["attached_to"] is None


@pytest.mark.asyncio
async def test_two_attachments_is_422(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    r = await client.post(
        "/tasks",
        json={
            "title": "Ambiguous",
            "project_id": book["project_id"],
            "company_id": book["company_id"],
        },
    )
    assert r.status_code == 422


# ── The status walk ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_status_walk_sets_and_clears_completed_at(client: AsyncClient, book: dict):
    """completed_at is set on DONE and CLEARED on the way back out.

    The clearing half is the one that gets forgotten, and it is the one that matters: a
    reopened task carrying a stale completed_at reads as finished in every
    "what shipped this week" query.
    """
    await _login(client, _PARTNER)
    task_id = (
        await client.post("/tasks", json={"title": "Walk", "project_id": book["project_id"]})
    ).json()["id"]

    for status_value in ("IN_PROGRESS", "BLOCKED", "DONE"):
        r = await client.patch(f"/tasks/{task_id}/status", json={"status": status_value})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status_value

    assert (await client.get(f"/tasks/{task_id}")).json()["completed_at"] is not None

    r = await client.patch(f"/tasks/{task_id}/status", json={"status": "IN_PROGRESS"})
    assert r.status_code == 200
    assert r.json()["completed_at"] is None


@pytest.mark.asyncio
async def test_archive_and_unarchive(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    task_id = (
        await client.post("/tasks", json={"title": "Gone", "project_id": book["project_id"]})
    ).json()["id"]

    r = await client.delete(f"/tasks/{task_id}")
    assert r.status_code == 200
    assert r.json() == {"detail": "Task archived"}

    ids = [t["id"] for t in (await client.get("/tasks")).json()["items"]]
    assert task_id not in ids

    assert (await client.post(f"/tasks/{task_id}/unarchive")).status_code == 200
    ids = [t["id"] for t in (await client.get("/tasks")).json()["items"]]
    assert task_id in ids


# ── RBAC ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_task_on_invisible_project_is_404_not_403(
    client: AsyncClient, db_session: AsyncSession, firm: Firm, partner: User, analyst: User
):
    """A stranger's task must be indistinguishable from one that never existed."""
    other = Project(firm_id=firm.id, name="Not Yours", client_name="Beta")
    db_session.add(other)
    await db_session.flush()
    task = Task(
        firm_id=firm.id, project_id=other.id, scope="PROJECT", title="Secret",
        status=TaskStatus.BACKLOG, priority="MEDIUM", created_by_id=partner.id,
    )
    db_session.add(task)
    await db_session.commit()

    await _login(client, _ANALYST)
    assert (await client.get(f"/tasks/{task.id}")).status_code == 404
    assert (await client.patch(f"/tasks/{task.id}/status", json={"status": "DONE"})).status_code == 404


@pytest.mark.asyncio
async def test_edit_rule_status_open_details_closed(
    client: AsyncClient, book: dict, analyst_b: User, db_session: AsyncSession
):
    """Analyst B may move Analyst A's task across the board but not rewrite it.

    Both halves in one test on purpose — the rule only means something as a pair.
    """
    # Analyst A's task, on a project both analysts can see.
    db_session.add(MandateAssignment(mandate_id=book["mandate_id"], user_id=analyst_b.id))
    await db_session.commit()

    await _login(client, _ANALYST)
    task_id = (
        await client.post("/tasks", json={"title": "A's task", "project_id": book["project_id"]})
    ).json()["id"]

    await _login(client, _ANALYST_B)
    assert (
        await client.patch(f"/tasks/{task_id}/status", json={"status": "IN_PROGRESS"})
    ).status_code == 200
    r = await client.patch(f"/tasks/{task_id}", json={"title": "B's rewrite"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_assignee_may_edit_details(client: AsyncClient, book: dict, analyst_b: User, db_session: AsyncSession):
    db_session.add(MandateAssignment(mandate_id=book["mandate_id"], user_id=analyst_b.id))
    await db_session.commit()

    await _login(client, _ANALYST)
    task_id = (
        await client.post(
            "/tasks",
            json={
                "title": "Delegated",
                "project_id": book["project_id"],
                "assignee_id": analyst_b.id,
            },
        )
    ).json()["id"]

    await _login(client, _ANALYST_B)
    r = await client.patch(f"/tasks/{task_id}", json={"notes": "on it"})
    assert r.status_code == 200
    assert r.json()["notes"] == "on it"


@pytest.mark.asyncio
async def test_partner_sees_both_analysts_tasks(
    client: AsyncClient, book: dict, analyst_b: User, db_session: AsyncSession
):
    db_session.add(MandateAssignment(mandate_id=book["mandate_id"], user_id=analyst_b.id))
    await db_session.commit()

    await _login(client, _ANALYST)
    await client.post("/tasks", json={"title": "From A", "project_id": book["project_id"]})
    await _login(client, _ANALYST_B)
    await client.post("/tasks", json={"title": "From B", "project_id": book["project_id"]})

    await _login(client, _PARTNER)
    titles = {t["title"] for t in (await client.get("/tasks")).json()["items"]}
    assert {"From A", "From B"} <= titles


@pytest.mark.asyncio
async def test_personal_task_is_absent_from_the_partners_firm_wide_list(
    client: AsyncClient, book: dict
):
    """The one genuinely private thing in the app. Leaks silently if missed."""
    await _login(client, _ANALYST)
    r = await client.post("/tasks", json={"title": "Dentist at four"})
    assert r.status_code == 201
    personal_id = r.json()["id"]

    await _login(client, _PARTNER)
    body = (await client.get("/tasks")).json()
    assert personal_id not in {t["id"] for t in body["items"]}
    assert (await client.get(f"/tasks/{personal_id}")).status_code == 404


@pytest.mark.asyncio
async def test_partner_cannot_edit_someone_elses_personal_task(
    client: AsyncClient, book: dict
):
    await _login(client, _ANALYST)
    personal_id = (await client.post("/tasks", json={"title": "Mine"})).json()["id"]

    await _login(client, _PARTNER)
    # Not visible at all, so even the status route (open to everyone who can see it) 404s.
    assert (
        await client.patch(f"/tasks/{personal_id}/status", json={"status": "DONE"})
    ).status_code == 404


@pytest.mark.asyncio
async def test_cross_firm_is_404(client: AsyncClient, db_session: AsyncSession, book: dict):
    other_firm = Firm(name="Other Firm")
    db_session.add(other_firm)
    await db_session.flush()
    stranger = User(
        firm_id=other_firm.id,
        email="stranger@other.com",
        hashed_password=hash_password("Passw0rd!"),
        full_name="Stranger",
        role=UserRole.PARTNER,
    )
    db_session.add(stranger)
    await db_session.commit()

    await _login(client, _PARTNER)
    task_id = (
        await client.post("/tasks", json={"title": "Ours", "project_id": book["project_id"]})
    ).json()["id"]

    await _login(client, {"email": "stranger@other.com", "password": "Passw0rd!"})
    assert (await client.get(f"/tasks/{task_id}")).status_code == 404
    assert (await client.get("/tasks")).json()["items"] == []


# ── Ordering, filters, summary ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_priority_sorts_by_rank_not_alphabetically(client: AsyncClient, book: dict):
    """VARCHAR priority sorts MEDIUM > LOW > HIGH. The sa.case() rank is why it doesn't."""
    await _login(client, _PARTNER)
    due = today_ist().isoformat()
    for priority in ("LOW", "HIGH", "MEDIUM"):
        await client.post(
            "/tasks",
            json={
                "title": priority,
                "project_id": book["project_id"],
                "priority": priority,
                "due_date": due,
            },
        )
    titles = [t["title"] for t in (await client.get("/tasks")).json()["items"]]
    assert titles == ["HIGH", "MEDIUM", "LOW"]


@pytest.mark.asyncio
async def test_undated_tasks_sort_below_dated_ones(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    await client.post("/tasks", json={"title": "Someday", "project_id": book["project_id"]})
    await client.post(
        "/tasks",
        json={
            "title": "Friday",
            "project_id": book["project_id"],
            "due_date": (today_ist() + timedelta(days=3)).isoformat(),
        },
    )
    titles = [t["title"] for t in (await client.get("/tasks")).json()["items"]]
    assert titles.index("Friday") < titles.index("Someday")


@pytest.mark.asyncio
async def test_overdue_uses_ist_today(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    await client.post(
        "/tasks",
        json={
            "title": "Late",
            "project_id": book["project_id"],
            "due_date": (today_ist() - timedelta(days=2)).isoformat(),
        },
    )
    body = (await client.get("/tasks", params={"overdue": True})).json()
    assert [t["title"] for t in body["items"]] == ["Late"]
    assert body["items"][0]["is_overdue"] is True
    assert body["summary"]["overdue"] == 1


@pytest.mark.asyncio
async def test_done_tasks_are_hidden_unless_asked_for(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    task_id = (
        await client.post("/tasks", json={"title": "Shipped", "project_id": book["project_id"]})
    ).json()["id"]
    await client.patch(f"/tasks/{task_id}/status", json={"status": "DONE"})

    assert (await client.get("/tasks")).json()["items"] == []
    body = (await client.get("/tasks", params={"include_done": True})).json()
    assert [t["title"] for t in body["items"]] == ["Shipped"]


@pytest.mark.asyncio
async def test_summary_route_resolves_before_the_detail_route(client: AsyncClient, book: dict):
    """Literal regression test: with /tasks/{id} first, "summary" 422s as a bad int."""
    await _login(client, _PARTNER)
    r = await client.get("/tasks/summary")
    assert r.status_code == 200, r.text
    assert "by_status" in r.json()


@pytest.mark.asyncio
async def test_summary_counts(client: AsyncClient, book: dict, partner: User):
    await _login(client, _PARTNER)
    await client.post(
        "/tasks",
        json={
            "title": "Today",
            "project_id": book["project_id"],
            "due_date": today_ist().isoformat(),
            "assignee_id": partner.id,
        },
    )
    await client.post(
        "/tasks",
        json={
            "title": "Late",
            "project_id": book["project_id"],
            "due_date": (today_ist() - timedelta(days=1)).isoformat(),
        },
    )
    s = (await client.get("/tasks/summary")).json()
    assert s["total"] == 2
    assert s["open"] == 2
    assert s["overdue"] == 1
    assert s["due_today"] == 1
    assert s["assigned_to_me"] == 1
    assert s["by_status"]["BACKLOG"] == 2
    assert [p["project_id"] for p in s["by_project"]] == [book["project_id"]]


@pytest.mark.asyncio
async def test_project_rollup_appears_on_the_projects_list(client: AsyncClient, book: dict):
    await _login(client, _PARTNER)
    await client.post(
        "/tasks",
        json={
            "title": "Late",
            "project_id": book["project_id"],
            "due_date": (today_ist() - timedelta(days=1)).isoformat(),
        },
    )
    items = (await client.get("/projects")).json()["items"]
    row = next(p for p in items if p["id"] == book["project_id"])
    assert row["open_task_count"] == 1
    assert row["overdue_task_count"] == 1

    detail = (await client.get(f"/projects/{book['project_id']}")).json()
    assert detail["tasks"]["open"] == 1
    assert detail["tasks"]["overdue"] == 1
    assert detail["tasks"]["by_status"]["BACKLOG"] == 1


# ── The denormalisation canary ────────────────────────────────────────────────


def test_mandate_cannot_be_reparented():
    """Tasks and activity rows cache their project_id.

    Nothing in the app moves a mandate between projects, and that is load-bearing rather
    than incidental: adding ``project_id`` to MandateUpdate would leave every cached
    project_id on tasks and activity rows pointing at the old project, silently. If this
    test fails, the reparent needs a migration that rewrites both tables — do not simply
    delete the assertion.
    """
    assert "project_id" not in MandateUpdate.model_fields
