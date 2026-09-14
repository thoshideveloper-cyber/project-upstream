"""WB-1 — client-workbook import, tested against the **real** client files.

These do not use synthetic fixtures: they load ``phase_2/Investors outreach.xlsx``,
``phase_2/PE related buyers.xlsx`` and ``phase_2/Contact list.xlsx`` and assert real
outcomes — the counts the partner will actually see, named rows cross-checked by hand
against the spreadsheet, and the cadence math for a company with four follow-ups.

If the workbooks are not present (they are client data, not committed everywhere) the
module skips rather than passing vacuously.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.contact import Contact
from app.models.enums import (
    CompanyStatus,
    ImportSource,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Sentiment,
    Source,
    StoppedReason,
    UserRole,
)
from app.models.firm import Firm
from app.models.import_batch import ImportBatch
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.sourcing_layer import SourcingLayer
from app.models.user import User
from app.services import workbook_import as wb
from app.services.profiles import compute_name_key
from app.services.workbook_parse import CONTACTS, MASTER, SCHEDULE, parse_workbook

WORKBOOK_DIR = Path(__file__).resolve().parents[2] / "phase_2"
GAIL_FILE = WORKBOOK_DIR / "Investors outreach.xlsx"
PE_FILE = WORKBOOK_DIR / "PE related buyers.xlsx"
CONTACTS_FILE = WORKBOOK_DIR / "Contact list.xlsx"

pytestmark = pytest.mark.skipif(
    not (GAIL_FILE.exists() and PE_FILE.exists() and CONTACTS_FILE.exists()),
    reason="client workbooks not present in phase_2/",
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def gail_parsed():
    return parse_workbook(GAIL_FILE.read_bytes(), GAIL_FILE.name)


@pytest.fixture
def pe_parsed():
    return parse_workbook(PE_FILE.read_bytes(), PE_FILE.name)


@pytest.fixture
def contacts_parsed():
    return parse_workbook(CONTACTS_FILE.read_bytes(), CONTACTS_FILE.name)


async def _batch(db: AsyncSession, firm_id: int, user_id: int, filename: str) -> ImportBatch:
    batch = ImportBatch(
        firm_id=firm_id,
        uploaded_by=user_id,
        source=ImportSource.WORKBOOK,
        filename=filename,
    )
    db.add(batch)
    await db.flush()
    return batch


def _gail_plan(project_name: str = "GAIL") -> wb.WorkbookPlan:
    return wb.WorkbookPlan(
        new_project={"name": project_name, "client_name": project_name},
        sheets=[
            wb.SheetPlan(
                sheet="Company list 1",
                kind=MASTER,
                new_mandate={"name": "GAIL capital raise", "type": MandateType.CAPITAL_RAISE.value},
                schedule_sheet="Emailing schedule",
            )
        ],
    )


def _pe_plan() -> wb.WorkbookPlan:
    return wb.WorkbookPlan(
        new_project={"name": "22by7", "client_name": "22by7"},
        sheets=[
            wb.SheetPlan(
                sheet="PE names final",
                kind=MASTER,
                new_mandate={"name": "PE buyers", "type": MandateType.SELL_SIDE.value},
                schedule_sheet="Emailing schedule",
                schedule_regarding="PE",
            ),
            wb.SheetPlan(
                sheet="PE porfolio names final",
                kind=MASTER,
                new_mandate={
                    "name": "PE portfolio buyers",
                    "type": MandateType.SELL_SIDE.value,
                    "exchange_rate": 90.26,
                },
                schedule_sheet="Emailing schedule",
                schedule_regarding="Portfolio",
            ),
        ],
    )


# ── Parsing: the header block is real, and above the real column row ─────────


def test_locates_header_row_below_the_header_block(gail_parsed, pe_parsed, contacts_parsed):
    """Every sheet has 2–7 rows of preamble; row 1 is never the header."""
    assert gail_parsed.shape("Company list 1").header_row == 6
    assert pe_parsed.shape("PE names final").header_row == 5
    assert pe_parsed.shape("PE porfolio names final").header_row == 7
    assert contacts_parsed.shape("Contacts list").header_row == 5


def test_classifies_every_tab(pe_parsed):
    kinds = {s.title: s.kind for s in pe_parsed.sheets}
    assert kinds["PE names final"] == MASTER
    assert kinds["PE porfolio names final"] == MASTER
    assert kinds["Emailing schedule"] == SCHEDULE
    # Nav dividers and pivot tabs carry no importable rows.
    assert kinds["Master sheets and emailers >>>"] == "IGNORE"
    assert kinds["PE summary analysis"] == "IGNORE"
    # Research staging is recognised but is not an active master sheet.
    assert kinds["PE names"] == "LONGLIST"
    assert kinds["Remaining PE companies"] == "LONGLIST"


def test_reads_the_exchange_rate_without_eating_the_count(pe_parsed):
    """`Exchange rate as on date | 90.26` must not be mistaken for the running count."""
    shape = pe_parsed.shape("PE porfolio names final")
    assert float(shape.exchange_rate) == 90.26
    assert shape.declared_count == 60
    assert shape.data_row_count == 60


def test_row_counts_match_the_sheets(gail_parsed, pe_parsed, contacts_parsed):
    assert gail_parsed.shape("Company list 1").data_row_count == 70
    # Company list 2/3 are empty spares.
    assert gail_parsed.shape("Company list 2").data_row_count == 0
    assert pe_parsed.shape("PE names final").data_row_count == 70
    assert pe_parsed.shape("PE porfolio names final").data_row_count == 60
    assert contacts_parsed.shape("Contacts list").data_row_count == 104
    # One scheduler serves both PE master sheets (70 + 60).
    assert len(pe_parsed.schedule_rows_by_sheet["Emailing schedule"]) == 130


def test_schedule_row_carries_done_evidence(pe_parsed):
    """Trunorth: initial 12 Jan, four bi-weekly follow-ups, all four marked Done."""
    rows = pe_parsed.schedule_rows_by_sheet["Emailing schedule"]
    trunorth = next(r for r in rows if r.company_name == "Trunorth")
    assert trunorth.regarding == "PE"
    assert trunorth.initial_date == date(2026, 1, 12)
    assert trunorth.done_count == 4
    assert trunorth.follow_up_dates == [
        date(2026, 1, 26), date(2026, 2, 9), date(2026, 2, 23), date(2026, 3, 9)
    ]
    # A text-token status blanks the whole follow-up row (= STOP).
    mc = next(r for r in rows if r.company_name == "MC Partners")
    assert mc.status_token == "Got response"
    assert mc.done_count == 0


def test_suggested_plan_matches_each_master_sheet_to_its_scheduler_slice(pe_parsed):
    suggested = wb.suggest_plan(pe_parsed)
    by_sheet = {s["sheet"]: s for s in suggested["sheets"]}
    assert by_sheet["PE names final"]["schedule_regarding"] == "PE"
    assert by_sheet["PE porfolio names final"]["schedule_regarding"] == "Portfolio"
    assert by_sheet["PE names"]["kind"] == "IGNORE"  # long-list, opt-in only
    assert by_sheet["Master sheets and emailers >>>"]["kind"] == "IGNORE"


# ── Category + layer mapping (§7.2 / §7.3) ───────────────────────────────────


@pytest.mark.asyncio
async def test_excel_type_codes_map_to_the_firm_vocabulary(db_session, firm):
    from app.services.classification import seed_firm_categories

    vocab = await seed_firm_categories(db_session, firm.id)
    assert wb.resolve_category_code("PE", vocab) == "PRIVATE_EQUITY"
    assert wb.resolve_category_code("FO", vocab) == "FAMILY_OFFICE"
    assert wb.resolve_category_code("PMS", vocab) == "PMS"
    assert wb.resolve_category_code("PE/PC", vocab) == "PRIVATE_CREDIT"
    assert wb.resolve_category_code("VC", vocab) == "VENTURE_CAPITAL"
    assert wb.resolve_category_code("Strategic", vocab) == "STRATEGIC"
    assert wb.resolve_category_code("Investment bank", vocab) == "INVESTMENT_BANK"

    # PE/VC has no vocabulary entry of its own → nearest match, flagged.
    outcome = wb.RowOutcome(sheet="s", row_index=0, excel_row=1, name="x")
    assert wb.resolve_category_code("PE/VC", vocab, outcome) == "VENTURE_CAPITAL"
    assert any(f["code"] == wb.CATEGORY_APPROXIMATE for f in outcome.flags)

    # Anything genuinely unknown lands on Other and is flagged — never dropped.
    outcome = wb.RowOutcome(sheet="s", row_index=0, excel_row=1, name="x")
    assert wb.resolve_category_code("PE potfolio", vocab, outcome) == "OTHER"
    assert any(f["code"] == wb.CATEGORY_UNMAPPED for f in outcome.flags)


def test_status_tokens_classify_to_real_events():
    assert wb.classify_status_token("Got response")[0] == OutreachEventType.RESPONSE
    assert wb.classify_status_token("Vishnu got response")[0] == OutreachEventType.RESPONSE
    assert wb.classify_status_token("Got response from PE")[0] == OutreachEventType.RESPONSE
    assert wb.classify_status_token("Bounced")[0] == OutreachEventType.BOUNCE
    # There is no DECLINE event type — a decline is a negative response.
    assert wb.classify_status_token("Not interested") == (
        OutreachEventType.RESPONSE,
        Sentiment.NEGATIVE,
    )
    # Neither a response nor a bounce — the importer must not guess.
    assert wb.classify_status_token("Contact not found")[0] is None
    assert wb.classify_status_token("Priya Mam reach out")[0] is None


# ── Preview is a genuine dry run ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_preview_writes_nothing(db_session: AsyncSession, firm, partner, gail_parsed):
    async def counts() -> tuple[int, ...]:
        out = []
        for model in (Company, Contact, OutreachEvent, OutreachSchedule, Project,
                      Mandate, SourcingLayer, CompanyProfile):
            out.append(
                (await db_session.execute(select(func.count()).select_from(model))).scalar()
            )
        return tuple(out)

    before = await counts()
    result = await wb.preview_workbook(
        db_session, firm_id=firm.id, actor_id=partner.id,
        parsed=gail_parsed, plan=_gail_plan(),
    )
    await db_session.rollback()
    assert await counts() == before
    # …and it still produced a full plan.
    assert result["counts"]["companies"]["create"] == 70
    assert result["total"] == 70


@pytest.mark.asyncio
async def test_preview_counts_match_what_apply_writes(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    firm_id, actor_id = firm.id, partner.id  # survive the dry-run rollback below
    plan = _gail_plan()
    preview = await wb.preview_workbook(
        db_session, firm_id=firm_id, actor_id=actor_id, parsed=gail_parsed, plan=plan
    )
    await db_session.rollback()

    batch = await _batch(db_session, firm_id, actor_id, GAIL_FILE.name)
    summary = await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=plan,
        firm_id=firm_id, actor_id=actor_id,
    )
    await db_session.commit()

    assert summary["companies_created"] == preview["counts"]["companies"]["create"]
    assert summary["contacts_created"] == preview["counts"]["contacts"]["create"]
    assert summary["events_appended"] == preview["counts"]["events"]["append"]
    assert summary["layers_created"] == preview["counts"]["layers"]["create"]


# ── Apply: the GAIL workbook ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_gail_master_sheet_lands_whole(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    summary = await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    assert summary["companies_created"] == 70
    project = (
        await db_session.execute(select(Project).where(Project.firm_id == firm.id))
    ).scalar_one()
    assert project.name == "GAIL"
    mandate = (
        await db_session.execute(select(Mandate).where(Mandate.project_id == project.id))
    ).scalar_one()
    assert mandate.type == MandateType.CAPITAL_RAISE
    assert batch.project_id == project.id

    companies = (
        await db_session.execute(select(Company).where(Company.mandate_id == mandate.id))
    ).scalars().all()
    assert len(companies) == 70
    assert all(c.source == Source.IMPORTED for c in companies)
    # Type is derived from the engagement side, not asked for (BUG-7).
    assert {c.type.value for c in companies} == {"INVESTOR"}

    # Buckets became this engagement's sourcing layers, first-seen order preserved.
    layers = (
        await db_session.execute(
            select(SourcingLayer)
            .where(SourcingLayer.mandate_id == mandate.id)
            .order_by(SourcingLayer.sort_order)
        )
    ).scalars().all()
    assert [layer.name for layer in layers][:2] == ["Direct", "Secondary"]
    assert "Strategics" in {layer.name for layer in layers}


@pytest.mark.asyncio
async def test_mandala_capital_row_cross_checked_by_hand(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    """Row 7 of `Company list 1`, read straight off the spreadsheet:

    Mandala Capital | Mauritius | 2026-05-18 | Got response | PE |
    "Food and agriculture focused" | … | mandala-capital.com |
    Aditya Mody / Managing Director / amody@mandala-capital.com |
    Godavari Biorefineries | Direct | No
    """
    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Mandala Capital")
        )
    ).scalar_one()
    assert company.hq == "Mauritius"
    assert company.website == "https://mandala-capital.com/"
    assert company.rationale == "Food and agriculture focused"
    assert company.relevant_investments == "Godavari Biorefineries"
    # `Rev (INR Cr)` is a formula over an "X" exchange rate — 0 is not a revenue claim.
    assert company.revenue_inr_cr is None

    category = (
        await db_session.execute(
            select(CompanyProfile).where(CompanyProfile.id == company.profile_id)
        )
    ).scalar_one()
    assert category.company_name == "Mandala Capital"

    layer = (
        await db_session.execute(
            select(SourcingLayer).where(SourcingLayer.id == company.sourcing_layer_id)
        )
    ).scalar_one()
    assert layer.name == "Direct"

    contact = (
        await db_session.execute(select(Contact).where(Contact.company_id == company.id))
    ).scalar_one()
    assert contact.contact_person == "Aditya Mody"
    assert contact.designation == "Managing Director"
    assert contact.email == "amody@mandala-capital.com"
    assert contact.is_primary is True

    # "Got response" with no follow-ups: initial email, then the response — and the
    # response has no date in Excel, so it lands on the anchor.
    events = (
        await db_session.execute(
            select(OutreachEvent)
            .where(OutreachEvent.company_id == company.id)
            .order_by(OutreachEvent.occurred_on, OutreachEvent.id)
        )
    ).scalars().all()
    assert [e.event_type for e in events] == [
        OutreachEventType.INITIAL_EMAIL, OutreachEventType.RESPONSE
    ]
    assert events[0].occurred_on == date(2026, 5, 18)
    assert events[1].occurred_on == date(2026, 5, 18)

    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert schedule.initial_date == date(2026, 5, 18)
    assert schedule.status == ScheduleStatus.STOPPED
    assert schedule.stopped_reason == StoppedReason.RESPONDED
    assert company.status == CompanyStatus.RESPONDED


@pytest.mark.asyncio
async def test_text_token_initial_email_logs_nothing_and_never_ticks(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    """"Priya Mam reach out" in the Initial-email cell is a to-do, not a send."""
    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Anicut Capital")
        )
    ).scalar_one()
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert schedule.status == ScheduleStatus.AWAITING_INITIAL
    assert schedule.initial_date is None
    events = (
        await db_session.execute(
            select(func.count()).select_from(OutreachEvent).where(
                OutreachEvent.company_id == company.id
            )
        )
    ).scalar()
    assert events == 0
    assert company.status == CompanyStatus.NOT_CONTACTED


@pytest.mark.asyncio
async def test_preview_flags_the_rows_it_had_to_decide(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    result = await wb.preview_workbook(
        db_session, firm_id=firm.id, actor_id=partner.id,
        parsed=gail_parsed, plan=_gail_plan(),
    )
    await db_session.rollback()
    flags = {f["code"]: f["count"] for f in result["flags"]}

    # 5 rows have a text token where the initial-email date should be.
    assert flags[wb.NO_INITIAL_EMAIL] == 5
    # 23 rows carry a text-token Status, but those same 5 have no anchor and so log
    # nothing at all — leaving 18 terminal events that needed a synthesised date.
    assert flags[wb.APPROXIMATE_DATE] == 18
    # Every one of those 18 is a "Got response"/"Bounced" the importer could classify;
    # the unreadable tokens on this sheet are all on anchor-less rows.
    assert wb.UNCLASSIFIED_STATUS not in flags
    # Two rows have "Yes" leaked into the Bucket column.
    assert flags[wb.BUCKET_SUSPICIOUS] == 2
    assert flags[wb.PREVIOUSLY_CONTACTED] > 0

    approximate = [r for r in result["rows"] if any(
        f["code"] == wb.NO_INITIAL_EMAIL for f in r["flags"]
    )]
    assert {r["name"] for r in approximate} >= {"Anicut Capital", "Peepul Capital Advisors"}
    assert all(r["events"] == [] for r in approximate)


# ── Apply: the PE workbook — two master sheets, one shared scheduler ─────────


@pytest.mark.asyncio
async def test_pe_workbook_splits_one_scheduler_across_two_engagements(
    db_session: AsyncSession, firm, partner, pe_parsed
):
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    summary = await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    assert summary["companies_created"] == 130
    assert len(summary["mandates"]) == 2
    by_name = {m["name"]: m for m in summary["mandates"]}
    assert by_name["PE buyers"]["companies"] == 70
    assert by_name["PE portfolio buyers"]["companies"] == 60

    mandate = (
        await db_session.execute(select(Mandate).where(Mandate.name == "PE portfolio buyers"))
    ).scalar_one()
    assert float(mandate.exchange_rate) == 90.26


@pytest.mark.asyncio
async def test_trunorth_cadence_math_over_four_real_follow_ups(
    db_session: AsyncSession, firm, partner, pe_parsed
):
    """Trunorth is the fully-worked row: initial 12 Jan 2026, follow-ups on 26 Jan,
    9 Feb, 23 Feb and 9 Mar (all Done), status 10 Mar. Four follow-ups is the cap, so
    the cycle stops EXHAUSTED — the Excel "then it goes cold"."""
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(select(Company).where(Company.company_name == "Trunorth"))
    ).scalar_one()
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert schedule.initial_date == date(2026, 1, 12)
    assert schedule.cadence_interval_days == 14

    events = (
        await db_session.execute(
            select(OutreachEvent)
            .where(OutreachEvent.company_id == company.id)
            .order_by(OutreachEvent.occurred_on)
        )
    ).scalars().all()
    assert [e.event_type for e in events] == [
        OutreachEventType.INITIAL_EMAIL,
        OutreachEventType.FOLLOW_UP,
        OutreachEventType.FOLLOW_UP,
        OutreachEventType.FOLLOW_UP,
        OutreachEventType.FOLLOW_UP,
    ]
    assert [e.occurred_on for e in events] == [
        date(2026, 1, 12), date(2026, 1, 26), date(2026, 2, 9),
        date(2026, 2, 23), date(2026, 3, 9),
    ]

    from app.services.cadence import compute_cadence, get_followups_done

    done = await get_followups_done(db_session, schedule.id)
    assert done == 4
    assert schedule.status == ScheduleStatus.STOPPED
    assert schedule.stopped_reason == StoppedReason.EXHAUSTED
    cadence = compute_cadence(schedule, done)
    assert cadence["is_cold"] is True
    # The two inline contacts on the *final* sheets both land.
    contacts = (
        await db_session.execute(select(Contact).where(Contact.company_id == company.id))
    ).scalars().all()
    assert {c.contact_person for c in contacts} == {"Mahinder Singh Juneja", "Khushal Singla"}
    assert sum(1 for c in contacts if c.is_primary) == 1


@pytest.mark.asyncio
async def test_partial_follow_ups_stay_active_with_the_right_next_due(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    """Sharrp Ventures: initial 18 May, `Done | Done | 10 | 24` — two follow-ups done,
    so the schedule is still ACTIVE and the next due date is anchor + 3 × 14."""
    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Sharrp Ventures")
        )
    ).scalar_one()
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    from app.services.cadence import compute_cadence, get_followups_done

    done = await get_followups_done(db_session, schedule.id)
    assert done == 2
    assert schedule.status == ScheduleStatus.ACTIVE
    assert schedule.initial_date == date(2026, 5, 18)
    cadence = compute_cadence(schedule, done)
    # Fixed anchor: 18 May + 3 × 14 = 29 June, the sheet's own third bi-weekly date.
    assert cadence["next_due_date"] == date(2026, 6, 29)
    assert company.status == CompanyStatus.CONTACTED


@pytest.mark.asyncio
async def test_unreadable_status_token_becomes_a_note_not_a_guess(
    db_session: AsyncSession, firm, partner, pe_parsed
):
    """"Vishnu reached out" is neither a response nor a bounce. The importer must not
    guess one: it logs the verbatim token as a NOTE, leaves the cadence running, and
    flags the row so an analyst decides."""
    firm_id, actor_id = firm.id, partner.id  # survive the dry-run rollback below
    preview = await wb.preview_workbook(
        db_session, firm_id=firm_id, actor_id=actor_id, parsed=pe_parsed, plan=_pe_plan()
    )
    await db_session.rollback()
    unclassified = [
        r for r in preview["rows"]
        if any(f["code"] == wb.UNCLASSIFIED_STATUS for f in r["flags"])
    ]
    assert unclassified, "the PE portfolio sheet has unreadable status tokens"
    assert any(
        f["detail"] == "Vishnu reached out"
        for r in unclassified for f in r["flags"]
        if f["code"] == wb.UNCLASSIFIED_STATUS
    )
    assert all(r["events"][-1]["type"] == "NOTE" for r in unclassified)

    batch = await _batch(db_session, firm_id, actor_id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm_id, actor_id=actor_id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == unclassified[0]["name"])
        )
    ).scalar_one()
    note = (
        await db_session.execute(
            select(OutreachEvent).where(
                OutreachEvent.company_id == company.id,
                OutreachEvent.event_type == OutreachEventType.NOTE,
            )
        )
    ).scalar_one()
    assert "Imported status:" in (note.notes or "")
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    # A NOTE is not a stop — the cadence is left exactly where the evidence put it.
    assert schedule.stopped_reason != StoppedReason.RESPONDED


@pytest.mark.asyncio
async def test_bounced_row_stops_the_cadence(db_session: AsyncSession, firm, partner, pe_parsed):
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(select(Company).where(Company.company_name == "Recognize"))
    ).scalar_one()
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert schedule.status == ScheduleStatus.STOPPED
    assert schedule.stopped_reason == StoppedReason.BOUNCED
    assert company.status == CompanyStatus.BOUNCED
    types = {
        e.event_type
        for e in (
            await db_session.execute(
                select(OutreachEvent).where(OutreachEvent.company_id == company.id)
            )
        ).scalars().all()
    }
    assert types == {OutreachEventType.INITIAL_EMAIL, OutreachEventType.BOUNCE}


# ── Idempotency: re-running a corrected file must not duplicate ──────────────


@pytest.mark.asyncio
async def test_reapply_is_a_no_op(db_session: AsyncSession, firm, partner, pe_parsed):
    plan = _pe_plan()
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    first = await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=plan,
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    async def totals() -> dict:
        return {
            "companies": (
                await db_session.execute(select(func.count()).select_from(Company))
            ).scalar(),
            "contacts": (
                await db_session.execute(select(func.count()).select_from(Contact))
            ).scalar(),
            "events": (
                await db_session.execute(select(func.count()).select_from(OutreachEvent))
            ).scalar(),
            "schedules": (
                await db_session.execute(select(func.count()).select_from(OutreachSchedule))
            ).scalar(),
            "layers": (
                await db_session.execute(select(func.count()).select_from(SourcingLayer))
            ).scalar(),
            "profiles": (
                await db_session.execute(select(func.count()).select_from(CompanyProfile))
            ).scalar(),
            "mandates": (
                await db_session.execute(select(func.count()).select_from(Mandate))
            ).scalar(),
            "projects": (
                await db_session.execute(select(func.count()).select_from(Project))
            ).scalar(),
        }

    after_first = await totals()
    assert first["companies_created"] == 130
    assert after_first["events"] == first["events_appended"]

    # A fresh batch over the same file — as if the partner corrected and re-uploaded.
    batch2 = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    second = await wb.apply_workbook(
        db_session, batch=batch2, parsed=pe_parsed, plan=plan,
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    assert await totals() == after_first
    assert second["companies_created"] == 0
    assert second["companies_updated"] == 130
    assert second["contacts_created"] == 0
    assert second["events_appended"] == 0
    assert second["events_skipped"] == first["events_appended"]


@pytest.mark.asyncio
async def test_reimport_never_moves_the_anchor(
    db_session: AsyncSession, firm, partner, pe_parsed
):
    """initial_date is immutable: a corrected file with a different first-email date
    must not rewrite it, and must not append a second INITIAL_EMAIL."""
    plan = _pe_plan()
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=plan,
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(select(Company).where(Company.company_name == "Trunorth"))
    ).scalar_one()
    schedule = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert schedule.initial_date == date(2026, 1, 12)

    # Corrupt the source: pretend the analyst "fixed" the anchor to a week later.
    for row in pe_parsed.rows_by_sheet["PE names final"]:
        if row.get("company_name") == "Trunorth":
            row["initial_email"] = "2026-01-19"
    for sched_row in pe_parsed.schedule_rows_by_sheet["Emailing schedule"]:
        if sched_row.company_name == "Trunorth":
            sched_row.initial_date = date(2026, 1, 19)

    batch2 = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch2, parsed=pe_parsed, plan=plan,
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()
    await db_session.refresh(schedule)

    assert schedule.initial_date == date(2026, 1, 12)
    initials = (
        await db_session.execute(
            select(func.count()).select_from(OutreachEvent).where(
                OutreachEvent.company_id == company.id,
                OutreachEvent.event_type == OutreachEventType.INITIAL_EMAIL,
            )
        )
    ).scalar()
    assert initials == 1


@pytest.mark.asyncio
async def test_same_company_on_two_projects_shares_one_profile(
    db_session: AsyncSession, firm, partner, gail_parsed, pe_parsed
):
    """The firm-wide record is shared; the per-mandate rows are not (§8-A bridge)."""
    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    batch2 = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch2, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    # Convergent Finance is on GAIL's raise *and* 22by7's PE sheet.
    rows = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Convergent Finance")
        )
    ).scalars().all()
    assert len(rows) == 2
    assert rows[0].mandate_id != rows[1].mandate_id
    assert rows[0].profile_id == rows[1].profile_id

    total_companies = (
        await db_session.execute(select(func.count()).select_from(Company))
    ).scalar()
    total_profiles = (
        await db_session.execute(select(func.count()).select_from(CompanyProfile))
    ).scalar()
    # 70 + 70 + 60 per-mandate rows collapse onto 188 shared firm-wide records via the
    # same domain-then-name blocking `upsert_profile`/`find_duplicates` already use.
    assert total_companies == 200
    assert total_profiles == 188


# ── The firm-wide Contact List ────────────────────────────────────────────────


def _contacts_plan(mandate_id: int) -> wb.WorkbookPlan:
    return wb.WorkbookPlan(
        project_id=None,
        new_project={"name": "Firm rolodex", "client_name": "Firm rolodex"},
        sheets=[wb.SheetPlan(sheet="Contacts list", kind=CONTACTS)],
        reason_mandates={"22by7": mandate_id, "GAIL": mandate_id, "ProArch": mandate_id,
                         "Datalogixs": mandate_id, "Various": mandate_id},
        default_mandate_id=mandate_id,
    )


@pytest.mark.asyncio
async def test_contact_list_writes_context_onto_the_event(
    db_session: AsyncSession, firm, partner, mandate, contacts_parsed
):
    batch = await _batch(db_session, firm.id, partner.id, CONTACTS_FILE.name)
    summary = await wb.apply_workbook(
        db_session, batch=batch, parsed=contacts_parsed, plan=_contacts_plan(mandate.id),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    assert summary["contacts_created"] == 104
    assert summary["events_appended"] == 104
    # 94 distinct companies behind 104 people.
    assert summary["companies_created"] == 94

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Earthling Security")
        )
    ).scalar_one()
    contact = (
        await db_session.execute(select(Contact).where(Contact.company_id == company.id))
    ).scalar_one()
    assert contact.contact_person == "Yusuf H. Ahmed"
    assert contact.designation == "CEO"
    assert contact.email == "yusuf@earthlingsecurity.com"
    assert contact.reason == "22by7"
    assert contact.engagement.value == "BUY_SIDE"
    assert contact.mode.value == "EMAIL"
    assert contact.sentiment.value == "NEGATIVE"
    assert contact.date_connected == date(2025, 9, 23)
    assert "M&A on hold" in (contact.comments or "")

    # The event is the source of truth; the contact row is identity + latest-touch cache.
    event = (
        await db_session.execute(
            select(OutreachEvent).where(OutreachEvent.company_id == company.id)
        )
    ).scalar_one()
    assert event.event_type == OutreachEventType.RESPONSE
    assert event.occurred_on == date(2025, 9, 23)
    assert event.sentiment.value == "NEGATIVE"
    assert event.mode.value == "EMAIL"
    assert event.contact_id == contact.id
    assert "M&A on hold" in (event.notes or "")


@pytest.mark.asyncio
async def test_contact_list_reuses_the_master_sheet_company(
    db_session: AsyncSession, firm, partner, pe_parsed, contacts_parsed
):
    """Trunorth is already on the PE master sheet — the contact-list row must attach to
    it, not create a second company."""
    batch = await _batch(db_session, firm.id, partner.id, PE_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=pe_parsed, plan=_pe_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()
    pe_mandate = (
        await db_session.execute(select(Mandate).where(Mandate.name == "PE buyers"))
    ).scalar_one()

    batch2 = await _batch(db_session, firm.id, partner.id, CONTACTS_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch2, parsed=contacts_parsed,
        plan=_contacts_plan(pe_mandate.id), firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    rows = (
        await db_session.execute(
            select(Company).where(
                Company.company_name == "Trunorth", Company.mandate_id == pe_mandate.id
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_contact_list_preview_split_matches_what_apply_does(
    db_session: AsyncSession, firm, partner, mandate, contacts_parsed
):
    """The create/update split the partner approves must be the split they get.

    Ten companies on the Contact List have two people each. Apply creates the company on
    the first row and *updates* it on the second; a preview that forgets what it already
    decided reports two creates and disagrees with the apply by exactly that many rows.
    """
    firm_id, actor_id, mandate_id = firm.id, partner.id, mandate.id
    plan = _contacts_plan(mandate_id)
    preview = await wb.preview_workbook(
        db_session, firm_id=firm_id, actor_id=actor_id, parsed=contacts_parsed, plan=plan
    )
    await db_session.rollback()

    batch = await _batch(db_session, firm_id, actor_id, CONTACTS_FILE.name)
    summary = await wb.apply_workbook(
        db_session, batch=batch, parsed=contacts_parsed, plan=plan,
        firm_id=firm_id, actor_id=actor_id,
    )
    await db_session.commit()

    assert summary["companies_created"] == preview["counts"]["companies"]["create"]
    assert summary["companies_updated"] == preview["counts"]["companies"]["update"]
    assert summary["contacts_created"] == preview["counts"]["contacts"]["create"]
    assert summary["events_appended"] == preview["counts"]["events"]["append"]
    # 104 rows over fewer companies — the split is real, not an artefact.
    assert summary["companies_created"] < 104
    assert summary["companies_updated"] > 0


@pytest.mark.asyncio
async def test_contact_list_poc_matches_a_firm_user(
    db_session: AsyncSession, firm, partner, mandate, contacts_parsed
):
    vighnesh = User(
        firm_id=firm.id,
        email="vighnesh@test.com",
        hashed_password="x",
        full_name="Vighnesh Rao",
        role=UserRole.ANALYST,
    )
    db_session.add(vighnesh)
    await db_session.commit()

    batch = await _batch(db_session, firm.id, partner.id, CONTACTS_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=contacts_parsed, plan=_contacts_plan(mandate.id),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    company = (
        await db_session.execute(
            select(Company).where(Company.company_name == "Earthling Security")
        )
    ).scalar_one()
    event = (
        await db_session.execute(
            select(OutreachEvent).where(OutreachEvent.company_id == company.id)
        )
    ).scalar_one()
    assert event.owner_id == vighnesh.id


@pytest.mark.asyncio
async def test_contact_rows_with_no_mapped_engagement_are_skipped_not_guessed(
    db_session: AsyncSession, firm, partner, contacts_parsed
):
    plan = wb.WorkbookPlan(
        new_project={"name": "Rolodex", "client_name": "Rolodex"},
        sheets=[wb.SheetPlan(sheet="Contacts list", kind=CONTACTS)],
        reason_mandates={},
        default_mandate_id=None,
    )
    result = await wb.preview_workbook(
        db_session, firm_id=firm.id, actor_id=partner.id,
        parsed=contacts_parsed, plan=plan,
    )
    await db_session.rollback()
    assert result["counts"]["companies"]["create"] == 0
    assert all(r["action"] == "SKIP" for r in result["rows"])


# ── Firm scoping ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_import_is_firm_scoped(db_session: AsyncSession, firm, partner, gail_parsed):
    other = Firm(name="Other Firm")
    db_session.add(other)
    await db_session.commit()

    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id,
    )
    await db_session.commit()

    leaked = (
        await db_session.execute(
            select(func.count()).select_from(Company).where(Company.firm_id == other.id)
        )
    ).scalar()
    assert leaked == 0
    for model in (Project, Mandate, Contact, OutreachEvent, OutreachSchedule, SourcingLayer):
        stray = (
            await db_session.execute(
                select(func.count()).select_from(model).where(model.firm_id != firm.id)
            )
        ).scalar()
        assert stray == 0, model.__name__


# ── The audit trail ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_import_rows_record_the_resolved_graph(
    db_session: AsyncSession, firm, partner, gail_parsed
):
    from app.models.import_row import ImportRow

    batch = await _batch(db_session, firm.id, partner.id, GAIL_FILE.name)
    staged = []
    for i, row in enumerate(gail_parsed.rows_by_sheet["Company list 1"]):
        import_row = ImportRow(
            batch_id=batch.id, row_index=i, sheet_name="Company list 1", raw=row
        )
        db_session.add(import_row)
        staged.append(import_row)
    await db_session.flush()

    await wb.apply_workbook(
        db_session, batch=batch, parsed=gail_parsed, plan=_gail_plan(),
        firm_id=firm.id, actor_id=partner.id, import_rows=staged,
    )
    await db_session.commit()

    assert all(r.action is not None for r in staged)
    assert all(r.resolved_company_id is not None for r in staged)
    assert all(r.resolved_schedule_id is not None for r in staged)
    assert all(r.resolved_profile_id is not None for r in staged)
    mandala = next(r for r in staged if r.raw.get("company_name") == "Mandala Capital")
    company = (
        await db_session.execute(
            select(Company).where(Company.id == mandala.resolved_company_id)
        )
    ).scalar_one()
    assert company.company_name == "Mandala Capital"
    assert compute_name_key(company.company_name) == compute_name_key("Mandala Capital")
