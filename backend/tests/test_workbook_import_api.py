"""WB-1 — the workbook wizard end to end over HTTP, against a real client workbook.

Covers the four steps a user actually walks (inspect → map → preview → apply), the
visibility scoping that replaced the old partner-only gate, and that re-applying an
applied batch is a no-op.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import MandateType
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.project import Project

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}

WORKBOOK_DIR = Path(__file__).resolve().parents[2] / "phase_2"
GAIL_FILE = WORKBOOK_DIR / "Investors outreach.xlsx"

pytestmark = pytest.mark.skipif(
    not GAIL_FILE.exists(), reason="client workbooks not present in phase_2/"
)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _inspect(client: AsyncClient) -> dict:
    resp = await client.post(
        "/imports/workbook/inspect",
        files={"file": (GAIL_FILE.name, GAIL_FILE.read_bytes(), XLSX_MIME)},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _plan(batch_id: int) -> dict:
    return {
        "batch_id": batch_id,
        "plan": {
            "new_project": {"name": "GAIL", "client_name": "GAIL"},
            "sheets": [
                {
                    "sheet": "Company list 1",
                    "kind": "MASTER",
                    "new_mandate": {
                        "name": "GAIL capital raise",
                        "type": MandateType.CAPITAL_RAISE.value,
                    },
                    "schedule_sheet": "Emailing schedule",
                },
                {"sheet": "Company list 2", "kind": "IGNORE"},
                {"sheet": "Company list 3", "kind": "IGNORE"},
            ],
        },
    }


@pytest.mark.asyncio
async def test_analyst_can_import_all_three_client_workbooks_unaided(
    client: AsyncClient, analyst, db_session: AsyncSession
):
    """Every file the client actually has, imported by an analyst with no partner help.

    The Contact List is the one that could not work on its own: its ``Reason`` column is
    the client, so it maps onto engagements — which only exist because the analyst's own
    two earlier imports created them *and* assigned them. It is imported last for exactly
    that reason.
    """
    await _login(client, ANALYST)

    # 1 — the GAIL book: one master sheet plus its scheduler.
    gail = await _inspect(client)
    resp = await client.post("/imports/workbook/apply", json=_plan(gail["batch_id"]))
    assert resp.status_code == 200, resp.text

    # 2 — the 22by7 book: two master sheets sharing one scheduler.
    pe_file = WORKBOOK_DIR / "PE related buyers.xlsx"
    resp = await client.post(
        "/imports/workbook/inspect",
        files={"file": (pe_file.name, pe_file.read_bytes(), XLSX_MIME)},
    )
    assert resp.status_code == 201, resp.text
    pe_plan = {
        "batch_id": resp.json()["batch_id"],
        "plan": {
            "new_project": {"name": "22by7", "client_name": "22by7"},
            "sheets": [
                {
                    "sheet": "PE names final",
                    "kind": "MASTER",
                    "new_mandate": {"name": "PE buyers", "type": MandateType.BUY_SIDE.value},
                    "schedule_sheet": "Emailing schedule",
                    "schedule_regarding": "PE",
                },
                {
                    "sheet": "PE porfolio names final",
                    "kind": "MASTER",
                    "new_mandate": {
                        "name": "PE portfolio buyers",
                        "type": MandateType.BUY_SIDE.value,
                    },
                    "schedule_sheet": "Emailing schedule",
                    "schedule_regarding": "Portfolio",
                },
            ],
        },
    }
    assert (await client.post("/imports/workbook/apply", json=pe_plan)).status_code == 200

    # 3 — the Contact List, mapped onto the engagements the analyst just created. The
    # wizard only offers what is on their desk, so this is also the scoping proof.
    targets = (await client.get("/imports/workbook/targets")).json()
    by_name = {m["name"]: m["id"] for m in targets["mandates"]}
    assert {"GAIL capital raise", "PE buyers", "PE portfolio buyers"} <= set(by_name)

    contacts_file = WORKBOOK_DIR / "Contact list.xlsx"
    resp = await client.post(
        "/imports/workbook/inspect",
        files={"file": (contacts_file.name, contacts_file.read_bytes(), XLSX_MIME)},
    )
    assert resp.status_code == 201, resp.text
    contact_plan = {
        "batch_id": resp.json()["batch_id"],
        "plan": {
            "project_id": next(p["id"] for p in targets["projects"] if p["name"] == "22by7"),
            "sheets": [{"sheet": "Contacts list", "kind": "CONTACTS"}],
            # The file's other Reasons (ProArch, Datalogixs, Various, 22by7/GAIL) have no
            # engagement, and are left unmapped on purpose — they skip, never guess.
            "reason_mandates": {
                "22by7": by_name["PE buyers"],
                "GAIL": by_name["GAIL capital raise"],
            },
        },
    }
    resp = await client.post("/imports/workbook/apply", json=contact_plan)
    assert resp.status_code == 200, resp.text

    # All three landed, and the analyst can see the lot.
    projects = {p["name"] for p in (await client.get("/projects")).json()["items"]}
    assert {"GAIL", "22by7"} <= projects
    companies = (
        await db_session.execute(select(func.count()).select_from(Company))
    ).scalar_one()
    assert companies > 150, companies


@pytest.mark.asyncio
async def test_analyst_can_run_the_wizard_and_owns_what_they_import(
    client: AsyncClient, analyst, db_session: AsyncSession
):
    """An analyst may open a project and an engagement by hand, so importing the book
    they already keep in a spreadsheet is the same act — and it has to land on their
    desk, not in a book they cannot see."""
    await _login(client, ANALYST)
    assert (await client.get("/imports/workbook/targets")).status_code == 200

    body = await _inspect(client)
    dry = await client.post("/imports/workbook/preview", json=_plan(body["batch_id"]))
    assert dry.status_code == 200, dry.text
    resp = await client.post("/imports/workbook/apply", json=_plan(body["batch_id"]))
    assert resp.status_code == 200, resp.text

    # Visibility runs off mandate_assignments: the engagement the import created must
    # be assigned to the analyst, or they just imported a book that is invisible to them.
    mandate_id = (
        await db_session.execute(select(Mandate.id).where(Mandate.name == "GAIL capital raise"))
    ).scalar_one()
    assigned = (
        await db_session.execute(
            select(MandateAssignment.user_id).where(MandateAssignment.mandate_id == mandate_id)
        )
    ).scalars().all()
    assert analyst.id in assigned

    projects = (await client.get("/projects")).json()["items"]
    assert any(p["name"] == "GAIL" for p in projects)


@pytest.mark.asyncio
async def test_analyst_cannot_touch_someone_elses_staged_batch(
    client: AsyncClient, partner, analyst
):
    """A staged batch holds the verbatim rows of someone's client workbook. Now that any
    role can stage one, a non-partner reaches only their own."""
    await _login(client, PARTNER)
    batch_id = (await _inspect(client))["batch_id"]

    await _login(client, ANALYST)
    assert (await client.get(f"/imports/workbook/{batch_id}")).status_code == 404
    assert (await client.post("/imports/workbook/preview", json=_plan(batch_id))).status_code == 404
    assert (await client.post("/imports/workbook/apply", json=_plan(batch_id))).status_code == 404


@pytest.mark.asyncio
async def test_analyst_cannot_import_into_a_book_they_are_not_on(
    client: AsyncClient, analyst, mandate, db_session: AsyncSession
):
    """The target list is scoped, but the plan is posted back as JSON — naming someone
    else's engagement directly must be refused, at preview as well as apply."""
    await _login(client, ANALYST)
    body = await _inspect(client)
    plan = _plan(body["batch_id"])
    # `mandate` belongs to the partner; the analyst has no assignment to it.
    plan["plan"]["sheets"][0] = {
        "sheet": "Company list 1",
        "kind": "MASTER",
        "mandate_id": mandate.id,
        "schedule_sheet": "Emailing schedule",
    }

    assert (await client.post("/imports/workbook/preview", json=plan)).status_code == 403
    assert (await client.post("/imports/workbook/apply", json=plan)).status_code == 403
    # Nothing was written on the way to the refusal.
    assert (
        await db_session.execute(
            select(func.count()).select_from(Company).where(Company.mandate_id == mandate.id)
        )
    ).scalar_one() == 0


@pytest.mark.asyncio
async def test_inspect_reports_the_shape_and_a_suggested_plan(client: AsyncClient, partner):
    await _login(client, PARTNER)
    body = await _inspect(client)

    kinds = {s["title"]: s["kind"] for s in body["sheets"]}
    assert kinds["Company list 1"] == "MASTER"
    assert kinds["Emailing schedule"] == "SCHEDULE"
    # Rows staged for every later step: 70 master rows + 70 scheduler rows.
    assert body["row_count"] == 140

    suggested = {s["sheet"]: s for s in body["suggested_plan"]["sheets"]}
    assert suggested["Company list 1"]["kind"] == "MASTER"
    assert suggested["Company list 1"]["schedule_sheet"] == "Emailing schedule"
    # The empty spare tabs are proposed as "leave it", not silently imported.
    assert suggested["Company list 2"]["kind"] == "IGNORE"
    assert suggested["Company list 2"]["row_count"] == 0


@pytest.mark.asyncio
async def test_rejects_a_file_that_is_not_a_workbook(client: AsyncClient, partner):
    await _login(client, PARTNER)
    resp = await client.post(
        "/imports/workbook/inspect",
        files={"file": ("notes.xlsx", b"this is not a spreadsheet", XLSX_MIME)},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_preview_then_apply_populates_the_project(
    client: AsyncClient, db_session: AsyncSession, partner
):
    await _login(client, PARTNER)
    body = await _inspect(client)
    batch_id = body["batch_id"]

    preview = await client.post("/imports/workbook/preview", json=_plan(batch_id))
    assert preview.status_code == 200, preview.text
    counts = preview.json()["counts"]
    assert counts["companies"]["create"] == 70
    assert counts["errors"] == 0
    assert preview.json()["project"]["is_new"] is True
    # A dry run leaves the master list empty.
    assert (
        await db_session.execute(select(func.count()).select_from(Company))
    ).scalar() == 0

    applied = await client.post("/imports/workbook/apply", json=_plan(batch_id))
    assert applied.status_code == 200, applied.text
    summary = applied.json()["summary"]
    assert applied.json()["status"] == "APPLIED"
    assert summary["companies_created"] == 70
    assert summary["events_appended"] == counts["events"]["append"]

    project = (
        await db_session.execute(select(Project).where(Project.name == "GAIL"))
    ).scalar_one()
    assert summary["project_id"] == project.id
    assert (
        await db_session.execute(select(func.count()).select_from(Company))
    ).scalar() == 70
    assert (
        await db_session.execute(select(func.count()).select_from(Contact))
    ).scalar() > 0
    assert (
        await db_session.execute(select(func.count()).select_from(OutreachEvent))
    ).scalar() == summary["events_appended"]

    # The audit record links every row to the slice of the graph it produced.
    audit = await client.get(f"/imports/workbook/{batch_id}")
    assert audit.status_code == 200
    rows = audit.json()["rows"]
    assert len(rows) == 70
    assert all(r["resolved_company_id"] for r in rows)
    assert all(r["sheet_name"] == "Company list 1" for r in rows)
    assert audit.json()["project_id"] == project.id


@pytest.mark.asyncio
async def test_reapplying_an_applied_batch_is_a_no_op(
    client: AsyncClient, db_session: AsyncSession, partner
):
    await _login(client, PARTNER)
    batch_id = (await _inspect(client))["batch_id"]
    await client.post("/imports/workbook/apply", json=_plan(batch_id))
    before = (await db_session.execute(select(func.count()).select_from(Company))).scalar()

    again = await client.post("/imports/workbook/apply", json=_plan(batch_id))
    assert again.status_code == 200
    assert again.json()["already_applied"] is True
    after = (await db_session.execute(select(func.count()).select_from(Company))).scalar()
    assert after == before


@pytest.mark.asyncio
async def test_apply_without_a_project_is_rejected(client: AsyncClient, partner):
    """One workbook = one client: the project is a required decision, never inferred."""
    await _login(client, PARTNER)
    batch_id = (await _inspect(client))["batch_id"]
    body = _plan(batch_id)
    body["plan"].pop("new_project")
    resp = await client.post("/imports/workbook/apply", json=body)
    assert resp.status_code == 422
    assert "project" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_targets_lists_projects_and_engagements(
    client: AsyncClient, partner, mandate
):
    await _login(client, PARTNER)
    resp = await client.get("/imports/workbook/targets")
    assert resp.status_code == 200
    assert any(m["id"] == mandate.id for m in resp.json()["mandates"])


@pytest.mark.asyncio
async def test_flag_vocabulary_is_published(client: AsyncClient, partner):
    await _login(client, PARTNER)
    resp = await client.get("/imports/workbook/flags")
    assert resp.status_code == 200
    codes = {f["code"] for f in resp.json()["flags"]}
    assert {"NO_INITIAL_EMAIL", "APPROXIMATE_DATE", "CATEGORY_UNMAPPED"} <= codes
