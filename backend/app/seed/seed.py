"""
Faker demo data for local development — NOT the deploy path.

A deployed Upstream starts empty and fills from the firm's own uploaded workbooks; the
only pre-filled surface is the Discover company database, which is real (see
``app/data/company_pool.py``). Use ``python -m app.seed.bootstrap --reset`` for that
genuine day-one state. This script exists to fabricate a *fat* book locally when you need
one screen full of every state at once — a cold company, a restarted cadence,
cross-mandate duplicates — without importing spreadsheets first.

Everything it writes is invented, so it refuses to run against anything but SQLite
(``--i-know`` overrides, if you really mean it). Never point it at a production database:
fake revenue on a screen an analyst makes calls from is worse than a blank one.

Usage:
    python -m app.seed.seed           # add data (skip if firm exists)
    python -m app.seed.seed --reset   # drop + recreate + seed

Produces:
  1 firm · 5 users (1 PARTNER, 4 ANALYSTS)
  3 projects · 5 mandates (Medanta is two-sided: sell + buy)
  ~120+ companies with CompanyCategory · contacts · realistic schedule mix
  ~8 deliberate cross-mandate duplicates
  1 EXHAUSTED (cold) company  · 1 RESTARTED company (2 cycles)
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import today_ist
from app.db.base import Base
from app.models import (
    Company,
    CompanyCategoryVocab,
    CompanyProfile,
    Contact,
    Firm,
    Mandate,
    MandateAssignment,
    OutreachEvent,
    OutreachSchedule,
    Project,
    SourcingLayer,
    SourcingStage,
    User,
)
from app.services.classification import (
    DEFAULT_CATEGORIES,
    DEFAULT_LAYERS_BY_TYPE,
    LEGACY_ENUM_TO_CODE,
)
from app.services.sourcing import DEFAULT_STAGES
from app.services.cross_mandate import extract_domain, normalise_name
from app.services.profiles import STATIC_FACT_FIELDS
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    ContactMode,
    Engagement,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
    StoppedReason,
    UserRole,
)

fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEMO_PASSWORD = "Passw0rd!"

# ── Static data ───────────────────────────────────────────────────────────────

USERS_SPEC = [
    ("Arjun Mehta", "partner@upstream.test", UserRole.PARTNER),
    ("Priya Sharma", "analyst1@upstream.test", UserRole.ANALYST),
    ("Rahul Gupta", "analyst2@upstream.test", UserRole.ANALYST),
    ("Neha Patel", "analyst3@upstream.test", UserRole.ANALYST),
    ("Vikram Singh", "analyst4@upstream.test", UserRole.ANALYST),
]

# Firm-shared email starter templates (name, kind, subject, body). Variables are
# resolved live in the compose editor: {{first_name}} {{company}} {{sender_name}}.
EMAIL_TEMPLATES_SPEC = [
    (
        "Intro — mandate outreach",
        "INITIAL",
        "Exploring a fit with {{company}}",
        "Hi {{first_name}},\n\n"
        "I'm reaching out from our advisory desk — we're running a mandate where "
        "{{company}} stands out as a strong potential fit, and I'd value a short "
        "conversation to test that read.\n\n"
        "Would you be open to a 15-minute call this week or next? Happy to work "
        "around your calendar.\n\nBest,\n{{sender_name}}",
    ),
    (
        "Follow-up — gentle nudge",
        "FOLLOW_UP",
        "Re: exploring a fit with {{company}}",
        "Hi {{first_name}},\n\n"
        "Following up on my earlier note about the mandate we're running. Timing "
        "matters on this one, and I'd still welcome your read on whether it's "
        "relevant for {{company}}.\n\n"
        "If a call is easier, I can send over a couple of slots.\n\nBest,\n{{sender_name}}",
    ),
    (
        "Follow-up — value add",
        "FOLLOW_UP",
        "One more thought for {{company}}",
        "Hi {{first_name}},\n\n"
        "Since my last note, activity in your space has picked up on our side — "
        "we've seen comparable conversations move quickly this quarter.\n\n"
        "If exploring this now isn't right for {{company}}, a quick 'not now' is "
        "genuinely helpful too.\n\nBest,\n{{sender_name}}",
    ),
    (
        "Breakup — closing the loop",
        "BREAKUP",
        "Closing the loop",
        "Hi {{first_name}},\n\n"
        "I'll take the silence as a 'not right now' and close this out on my side — "
        "no more emails from me on this.\n\n"
        "If circumstances change at {{company}}, my door stays open. Wishing you a "
        "strong quarter.\n\nBest,\n{{sender_name}}",
    ),
]

# Projects group mandates by client_name. Medanta is two-sided (sell + buy).
PROJECTS_SPEC = [
    {"name": "Medanta Healthcare", "client_name": "Medanta Healthcare"},
    {"name": "IndInfra Capital", "client_name": "IndInfra Capital"},
    {"name": "GreenGrow Ventures", "client_name": "GreenGrow Ventures"},
    {"name": "Minda Group", "client_name": "Minda Group"},
]

MANDATES_SPEC = [
    {
        "client_name": "Medanta Healthcare",
        "name": "Pharma Consolidation — Medanta",
        "type": MandateType.SELL_SIDE,
        "exchange_rate": Decimal("83.12"),
        "exchange_rate_date": date(2024, 3, 1),
        "assigned_indices": [1, 3],  # analyst1, analyst3
    },
    {
        # Two-sided: BUY mandate under the same Medanta project (B4 compliance:
        # client_name must match byte-for-byte so the migration backfill groups them)
        "client_name": "Medanta Healthcare",
        "name": "Strategic Acquisitions — Medanta Buy",
        "type": MandateType.BUY_SIDE,
        "exchange_rate": Decimal("83.12"),
        "exchange_rate_date": date(2024, 3, 1),
        "assigned_indices": [1, 3],  # same team
    },
    {
        "client_name": "IndInfra Capital",
        "name": "PE Infrastructure Buyout — IndInfra",
        "type": MandateType.BUY_SIDE,
        "exchange_rate": Decimal("83.45"),
        "exchange_rate_date": date(2024, 3, 15),
        "assigned_indices": [2, 3],  # analyst2, analyst3
    },
    {
        "client_name": "GreenGrow Ventures",
        "name": "AgriTech Capital Raise — GreenGrow",
        "type": MandateType.CAPITAL_RAISE,
        "exchange_rate": Decimal("83.20"),
        "exchange_rate_date": date(2024, 2, 28),
        "assigned_indices": [1, 4],  # analyst1, analyst4
    },
    {
        "client_name": "Minda Group",
        "name": "Auto Components M&A — MindaGroup",
        "type": MandateType.SELL_SIDE,
        "exchange_rate": Decimal("83.30"),
        "exchange_rate_date": date(2024, 3, 10),
        "assigned_indices": [2, 4],  # analyst2, analyst4
    },
]

# ── Company lists (one per original mandate slot) ────────────────────────────

PHARMA_COMPANIES = [
    ("Sun Pharmaceutical Industries", "Mumbai", "sunpharma.com", CompanyCategory.STRATEGIC),
    ("Dr Reddy's Laboratories", "Hyderabad", "drreddys.com", CompanyCategory.STRATEGIC),
    ("Cipla Ltd", "Mumbai", "cipla.com", CompanyCategory.STRATEGIC),
    ("Lupin Pharmaceuticals", "Mumbai", "lupin.com", CompanyCategory.STRATEGIC),
    ("Aurobindo Pharma", "Hyderabad", "aurobindo.com", CompanyCategory.PRIVATE_EQUITY),
    ("Alkem Laboratories", "Mumbai", "alkemlabs.com", CompanyCategory.STRATEGIC),
    ("Torrent Pharmaceuticals", "Ahmedabad", "torrentpharma.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Cadila Healthcare", "Ahmedabad", "zyduscadila.com", CompanyCategory.STRATEGIC),
    ("Biocon Ltd", "Bengaluru", "biocon.com", CompanyCategory.VENTURE_CAPITAL),
    ("Abbott India", "Mumbai", "abbott.com", CompanyCategory.STRATEGIC),
    ("Pfizer India", "Mumbai", "pfizerindia.com", CompanyCategory.STRATEGIC),
    ("Novartis India", "Mumbai", "novartis.com", CompanyCategory.STRATEGIC),
    ("GlaxoSmithKline India", "Mumbai", "gsk.com", CompanyCategory.STRATEGIC),
    ("Sanofi India", "Mumbai", "sanofi.com", CompanyCategory.STRATEGIC),
    ("Jubilant Pharma", "Noida", "jubilantpharma.com", CompanyCategory.PRIVATE_EQUITY),
    ("Divis Laboratories", "Hyderabad", "divislabs.com", CompanyCategory.STRATEGIC),
    ("Granules India", "Hyderabad", "granulesindia.com", CompanyCategory.OTHER),
    ("Natco Pharma", "Hyderabad", "natcopharma.com", CompanyCategory.OTHER),
    ("Laurus Labs", "Hyderabad", "lauruslabs.com", CompanyCategory.PRIVATE_EQUITY),
    ("Suven Pharmaceuticals", "Hyderabad", "suven.com", CompanyCategory.VENTURE_CAPITAL),
    ("Caplin Point Laboratories", "Chennai", "caplinpoint.com", CompanyCategory.OTHER),
    ("Solara Active Pharma", "Mumbai", "solaraactivepharma.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Sequent Scientific", "Mumbai", "sequent.in", CompanyCategory.OTHER),
    ("JB Pharma", "Mumbai", "jbpharma.com", CompanyCategory.STRATEGIC),
    ("Mankind Pharma", "New Delhi", "mankindpharma.com", CompanyCategory.STRATEGIC),
    ("Eris Lifesciences", "Ahmedabad", "eris.co.in", CompanyCategory.PRIVATE_EQUITY),
    ("Glenmark Pharma", "Mumbai", "glenmarkpharma.com", CompanyCategory.STRATEGIC),
    ("Ipca Laboratories", "Mumbai", "ipca.com", CompanyCategory.STRATEGIC),
    ("Strides Pharma", "Bengaluru", "strides.com", CompanyCategory.FINANCIAL_SPONSOR),
]

INFRA_COMPANIES = [
    ("IRB Infrastructure Developers", "Mumbai", "irb.co.in", CompanyCategory.PRIVATE_EQUITY),
    ("L&T Infrastructure Development", "Mumbai", "larsentoubro.com", CompanyCategory.STRATEGIC),
    ("GMR Airports Infrastructure", "New Delhi", "gmrgroup.in", CompanyCategory.FINANCIAL_SPONSOR),
    ("Adani Ports and SEZ", "Ahmedabad", "adaniports.com", CompanyCategory.STRATEGIC),
    ("Container Corporation of India", "New Delhi", "concorindia.com", CompanyCategory.STRATEGIC),
    ("Indus Towers", "Gurugram", "industowers.com", CompanyCategory.PRIVATE_EQUITY),
    ("Power Grid Corporation", "Gurugram", "powergridindia.com", CompanyCategory.STRATEGIC),
    ("Torrent Power", "Ahmedabad", "torrentpower.com", CompanyCategory.STRATEGIC),
    ("CESC Ltd", "Kolkata", "cesc.co.in", CompanyCategory.OTHER),
    ("Tata Power Company", "Mumbai", "tatapower.com", CompanyCategory.STRATEGIC),
    ("NTPC Ltd", "New Delhi", "ntpc.co.in", CompanyCategory.STRATEGIC),
    ("Greenko Group", "Hyderabad", "greenkogroup.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Hero Future Energies", "New Delhi", "herofutureenergies.com", CompanyCategory.VENTURE_CAPITAL),
    ("Acme Solar Holdings", "Gurugram", "acmesolar.in", CompanyCategory.PRIVATE_EQUITY),
    ("Sterlite Power Grid", "Gurugram", "sterlitepower.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Patel Engineering", "Mumbai", "pateleng.com", CompanyCategory.OTHER),
    ("HCC Ltd", "Mumbai", "hcc.com", CompanyCategory.OTHER),
    ("Dilip Buildcon", "Bhopal", "dilipbuildcon.com", CompanyCategory.STRATEGIC),
    ("KNR Constructions", "Hyderabad", "knrconstructions.com", CompanyCategory.OTHER),
    ("PNC Infratech", "Agra", "pncinfratech.com", CompanyCategory.OTHER),
    ("Ashoka Buildcon", "Nashik", "ashokabuildcon.com", CompanyCategory.STRATEGIC),
    ("G R Infraprojects", "Udaipur", "grinfraprojects.com", CompanyCategory.PRIVATE_EQUITY),
    ("Kalpataru Projects International", "Mumbai", "kalpataruprojects.com", CompanyCategory.STRATEGIC),
    ("Gayatri Projects", "Hyderabad", "gayatriprojects.com", CompanyCategory.OTHER),
    ("ITD Cementation India", "Mumbai", "itdcem.com", CompanyCategory.OTHER),
    ("JMC Projects India", "Ahmedabad", "jmcprojects.com", CompanyCategory.PRIVATE_EQUITY),
    ("NCC Ltd", "Hyderabad", "nccltd.in", CompanyCategory.STRATEGIC),
    ("MEIL Group", "Hyderabad", "meil.in", CompanyCategory.FINANCIAL_SPONSOR),
    ("Shapoorji Pallonji Infra", "Mumbai", "shapoorji.com", CompanyCategory.STRATEGIC),
]

AGRITECH_COMPANIES = [
    ("Mahindra Agri Solutions", "Mumbai", "mahindraagri.com", CompanyCategory.STRATEGIC),
    ("Ninjacart Technologies", "Bengaluru", "ninjacart.in", CompanyCategory.VENTURE_CAPITAL),
    ("DeHaat AgriTech", "Patna", "agrevolution.in", CompanyCategory.VENTURE_CAPITAL),
    ("WayCool Foods", "Chennai", "waycoolfoods.com", CompanyCategory.VENTURE_CAPITAL),
    ("FreshoKartz", "Bengaluru", "freshokartz.com", CompanyCategory.OTHER),
    ("BigHaat Agro", "Bengaluru", "bighaat.com", CompanyCategory.VENTURE_CAPITAL),
    ("BharatRohan Airborne", "Noida", "bharatrohan.in", CompanyCategory.VENTURE_CAPITAL),
    ("AgroStar India", "Ahmedabad", "agrostar.in", CompanyCategory.VENTURE_CAPITAL),
    ("Samunnati Financial", "Chennai", "samunnati.com", CompanyCategory.FAMILY_OFFICE),
    ("CropIn Technology", "Bengaluru", "cropin.com", CompanyCategory.VENTURE_CAPITAL),
    ("Fasal Analytics", "Bengaluru", "fasal.co", CompanyCategory.VENTURE_CAPITAL),
    ("Intello Labs", "Gurugram", "intellolabs.com", CompanyCategory.VENTURE_CAPITAL),
    ("Stellapps Technologies", "Bengaluru", "stellapps.com", CompanyCategory.VENTURE_CAPITAL),
    ("SatSure Analytics", "Bengaluru", "satsure.co", CompanyCategory.VENTURE_CAPITAL),
    ("Agnext Technologies", "Chandigarh", "agnext.com", CompanyCategory.OTHER),
    ("String Bio", "Bengaluru", "string.bio", CompanyCategory.VENTURE_CAPITAL),
    ("KissanPro", "Jaipur", "kissanpro.com", CompanyCategory.OTHER),
    ("Gobasco Foods", "Gurugram", "gobasco.com", CompanyCategory.OTHER),
    ("AgriBegri", "Mumbai", "agribegri.com", CompanyCategory.OTHER),
    ("Otipy Fresh", "Gurugram", "otipy.com", CompanyCategory.VENTURE_CAPITAL),
    ("Bijak AgriFinance", "Gurugram", "bijak.in", CompanyCategory.FAMILY_OFFICE),
    ("Kheyti Greenhouses", "Hyderabad", "kheyti.com", CompanyCategory.VENTURE_CAPITAL),
    ("Jivabhumi Organics", "Bengaluru", "jivabhumi.com", CompanyCategory.OTHER),
    ("FutureFarm Ventures", "Pune", "futurefarm.in", CompanyCategory.VENTURE_CAPITAL),
    ("Gram Unnati", "Bhopal", "gramunnati.com", CompanyCategory.OTHER),
    ("Fyllo Technologies", "New Delhi", "fyllo.in", CompanyCategory.VENTURE_CAPITAL),
    ("NFarm Agritech", "Hyderabad", "nfarm.co.in", CompanyCategory.OTHER),
    ("BioD Energy", "Pune", "biodenergy.in", CompanyCategory.VENTURE_CAPITAL),
    ("Sefai Technologies", "Bengaluru", "sefai.com", CompanyCategory.VENTURE_CAPITAL),
]

AUTO_COMPANIES = [
    ("Minda Industries", "Gurugram", "mindaind.com", CompanyCategory.STRATEGIC),
    ("Motherson Sumi Systems", "Noida", "motherson.com", CompanyCategory.STRATEGIC),
    ("Bharat Forge", "Pune", "bharatforge.com", CompanyCategory.STRATEGIC),
    ("Endurance Technologies", "Aurangabad", "enduranceindia.com", CompanyCategory.STRATEGIC),
    ("Amara Raja Batteries", "Tirupati", "amararaja.com", CompanyCategory.STRATEGIC),
    ("Exide Industries", "Kolkata", "exideindustries.com", CompanyCategory.STRATEGIC),
    ("JK Tyre & Industries", "New Delhi", "jktyre.com", CompanyCategory.STRATEGIC),
    ("Apollo Tyres", "Gurugram", "apollotyres.com", CompanyCategory.STRATEGIC),
    ("CEAT Ltd", "Mumbai", "ceat.com", CompanyCategory.PRIVATE_EQUITY),
    ("Balkrishna Industries", "Mumbai", "bkt-tires.com", CompanyCategory.STRATEGIC),
    ("Wabco India", "Chennai", "wabco-india.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Bosch India", "Bengaluru", "boschindia.com", CompanyCategory.STRATEGIC),
    ("Schaeffler India", "Vadodara", "schaeffler.co.in", CompanyCategory.STRATEGIC),
    ("SKF India", "Mumbai", "skfindia.com", CompanyCategory.FINANCIAL_SPONSOR),
    ("Timken India", "Kolkata", "timken.com", CompanyCategory.STRATEGIC),
    ("NRB Bearings", "Mumbai", "nrbbearings.com", CompanyCategory.OTHER),
    ("Suprajit Engineering", "Bengaluru", "suprajit.com", CompanyCategory.OTHER),
    ("Gabriel India", "Pune", "gabrielindia.com", CompanyCategory.OTHER),
    ("Lumax Industries", "Gurugram", "lumaxworld.in", CompanyCategory.OTHER),
    ("Sandhar Technologies", "New Delhi", "sandhar.com", CompanyCategory.PRIVATE_EQUITY),
    ("Minda Corp", "Gurugram", "mindacorp.com", CompanyCategory.STRATEGIC),
    ("Subros Ltd", "Noida", "subros.com", CompanyCategory.OTHER),
    ("Fiem Industries", "New Delhi", "fiemindustries.com", CompanyCategory.OTHER),
    ("Rico Auto Industries", "Gurugram", "ricoauto.in", CompanyCategory.PRIVATE_EQUITY),
    ("Sharda Motor Industries", "New Delhi", "shardamotor.com", CompanyCategory.OTHER),
    ("Sona BLW Precision", "Gurugram", "sonacoms.com", CompanyCategory.STRATEGIC),
    ("Mahindra CIE Automotive", "Mumbai", "mahindracie.com", CompanyCategory.STRATEGIC),
    ("Ramkrishna Forgings", "Kolkata", "ramkrishnaforgings.com", CompanyCategory.PRIVATE_EQUITY),
    ("Craftsman Automation", "Coimbatore", "craftsmanautomation.com", CompanyCategory.OTHER),
]

# 8 deliberate cross-mandate duplicate pairs
# (company_name, website, mandate_A_idx, mandate_B_idx)
# Note: indices now refer to MANDATES_SPEC (5 items); original 4 mandates are at
# indices 0,2,3,4 (Medanta-sell, IndInfra, GreenGrow, Minda)
CROSS_MANDATE_DUPES = [
    ("Mahindra Agri Solutions", "mahindraagri.com", 0, 3),   # Medanta-sell + GreenGrow
    ("L&T Infrastructure Development", "larsentoubro.com", 2, 4),  # IndInfra + Minda
    ("Tata Power Company", "tatapower.com", 2, 3),            # IndInfra + GreenGrow
    ("Bosch India", "boschindia.com", 4, 0),                   # Minda + Medanta-sell
    ("Cipla Ltd", "cipla.com", 0, 4),                          # Medanta-sell + Minda
    ("CESC Ltd", "cesc.co.in", 2, 0),                          # IndInfra + Medanta-sell
    ("Adani Ports and SEZ", "adaniports.com", 2, 4),           # IndInfra + Minda
    ("Sun Pharmaceutical Industries", "sunpharma.com", 0, 3),  # Medanta-sell + GreenGrow
]

HQ_CITIES = [
    "Mumbai", "New Delhi", "Bengaluru", "Hyderabad", "Pune",
    "Chennai", "Kolkata", "Ahmedabad", "Gurugram", "Noida",
]
DESIGNATIONS = [
    "Managing Director", "CEO", "CFO", "COO", "VP Corporate Development",
    "Director M&A", "Head of Strategy", "VP Finance", "General Manager",
    "VP Business Development", "Chief Strategy Officer", "Director Finance",
]


def _days_ago(n: int) -> date:
    return today_ist() - timedelta(days=n)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash(password: str) -> str:
    return pwd_context.hash(password)


def _company_lists() -> list[list[tuple]]:
    """Returns lists aligned to mandates 0,1,2,3,4 (Medanta-sell uses Pharma; Medanta-buy uses a subset)."""
    # Medanta buy-side uses a smaller set of strategic buyers
    medanta_buy = PHARMA_COMPANIES[:10]
    return [PHARMA_COMPANIES, medanta_buy, INFRA_COMPANIES, AGRITECH_COMPANIES, AUTO_COMPANIES]


def _make_schedule_and_events(
    session: Session,
    company: Company,
    analyst: User,
    target_state: str,  # "awaiting" | "active_ok" | "active_overdue" | "stopped"
    cycle_number: int = 1,
    is_current: bool = True,
    contact_id: int | None = None,
) -> OutreachSchedule:
    """Create an OutreachSchedule and supporting events for a company."""
    schedule = OutreachSchedule(
        firm_id=company.firm_id,
        company_id=company.id,
        cadence_interval_days=7,
        regarding=f"Introduction re {company.company_name}",
        cycle_number=cycle_number,
        is_current=is_current,
        contact_id=contact_id,
    )

    if target_state == "awaiting":
        schedule.status = ScheduleStatus.AWAITING_INITIAL
        session.add(schedule)
        session.flush()
        return schedule

    # ACTIVE variants — initial email was already sent
    if target_state == "active_ok":
        initial_days_ago = random.randint(20, 50)
    elif target_state == "active_overdue":
        initial_days_ago = random.randint(30, 90)
    else:  # stopped / exhausted
        initial_days_ago = random.randint(40, 120)

    initial_date = _days_ago(initial_days_ago)
    schedule.status = ScheduleStatus.ACTIVE
    schedule.initial_date = initial_date
    session.add(schedule)
    session.flush()

    session.add(
        OutreachEvent(
            firm_id=company.firm_id,
            company_id=company.id,
            schedule_id=schedule.id,
            event_type=OutreachEventType.INITIAL_EMAIL,
            occurred_on=initial_date,
            regarding=schedule.regarding,
            owner_id=analyst.id,
        )
    )

    followups = max(0, (initial_days_ago - 7) // 7)
    followups = min(followups, random.randint(1, 4))
    for i in range(1, followups + 1):
        fu_date = initial_date + timedelta(days=i * 7)
        if fu_date <= today_ist():
            session.add(
                OutreachEvent(
                    firm_id=company.firm_id,
                    company_id=company.id,
                    schedule_id=schedule.id,
                    event_type=OutreachEventType.FOLLOW_UP,
                    occurred_on=fu_date,
                    notes=f"Follow-up #{i}",
                    owner_id=analyst.id,
                )
            )

    if target_state == "stopped":
        stop_reason_choices = [
            (StoppedReason.RESPONDED, CompanyStatus.RESPONDED),
            (StoppedReason.DECLINED, CompanyStatus.DECLINED),
            (StoppedReason.BOUNCED, CompanyStatus.BOUNCED),
        ]
        stopped_reason, new_status = random.choice(stop_reason_choices)
        schedule.status = ScheduleStatus.STOPPED
        schedule.stopped_reason = stopped_reason
        schedule.stopped_at = _utcnow()
        company.status = new_status

        if stopped_reason == StoppedReason.RESPONDED:
            session.add(
                OutreachEvent(
                    firm_id=company.firm_id,
                    company_id=company.id,
                    schedule_id=schedule.id,
                    event_type=OutreachEventType.RESPONSE,
                    occurred_on=_days_ago(random.randint(5, 30)),
                    notes="Positive response received.",
                    owner_id=analyst.id,
                )
            )
        elif stopped_reason == StoppedReason.BOUNCED:
            session.add(
                OutreachEvent(
                    firm_id=company.firm_id,
                    company_id=company.id,
                    schedule_id=schedule.id,
                    event_type=OutreachEventType.BOUNCE,
                    occurred_on=_days_ago(random.randint(5, 20)),
                    notes="Email bounced — address invalid.",
                    owner_id=analyst.id,
                )
            )
    elif target_state in ("active_ok", "active_overdue"):
        company.status = CompanyStatus.CONTACTED
        if target_state == "active_overdue" and random.random() < 0.3:
            company.status = CompanyStatus.INTERESTED

    return schedule


def _make_exhausted_schedule(
    session: Session,
    company: Company,
    analyst: User,
    follow_up_cap: int = 4,
) -> None:
    """Create a schedule that hit the follow-up cap → EXHAUSTED (cold demo)."""
    initial_date = _days_ago(90)
    schedule = OutreachSchedule(
        firm_id=company.firm_id,
        company_id=company.id,
        cadence_interval_days=7,
        regarding=f"Introduction re {company.company_name}",
        cycle_number=1,
        is_current=True,
        status=ScheduleStatus.STOPPED,
        initial_date=initial_date,
        stopped_reason=StoppedReason.EXHAUSTED,
        stopped_at=_utcnow(),
    )
    session.add(schedule)
    session.flush()

    session.add(OutreachEvent(
        firm_id=company.firm_id, company_id=company.id, schedule_id=schedule.id,
        event_type=OutreachEventType.INITIAL_EMAIL, occurred_on=initial_date,
        owner_id=analyst.id,
    ))
    for i in range(1, follow_up_cap + 1):
        fu_date = initial_date + timedelta(days=i * 7)
        session.add(OutreachEvent(
            firm_id=company.firm_id, company_id=company.id, schedule_id=schedule.id,
            event_type=OutreachEventType.FOLLOW_UP, occurred_on=fu_date,
            notes=f"Follow-up #{i} (cap reached after this)", owner_id=analyst.id,
        ))

    company.status = CompanyStatus.CONTACTED


def _make_restarted_company(
    session: Session,
    firm: Firm,
    mandate: Mandate,
    analyst: User,
) -> None:
    """Create a company with 2 cycles: EXHAUSTED cycle-1 (archived) + fresh AWAITING cycle-2.

    Demonstrates the restart flow: contact swap → new anchor, full history intact.
    """
    company = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        company_name="Horizon Biotech (Restarted)",
        hq="Pune",
        type=CompanyType.TARGET,
        status=CompanyStatus.NOT_CONTACTED,
        rationale="Previously cold; new contact identified — restart approved.",
        website="https://www.horizonbiotech-demo.com",
        category=CompanyCategory.STRATEGIC,
        source=Source.REFERRAL,
        source_quality=SourceQuality.HIGH,
        created_by_id=analyst.id,
    )
    session.add(company)
    session.flush()

    # Contact for cycle 1 (old)
    old_contact = Contact(
        firm_id=firm.id, company_id=company.id,
        contact_person="Ramesh Iyer", designation="CFO",
        email="ramesh.iyer@horizonbiotech-demo.com",
        engagement=Engagement.SELL_SIDE,
        is_primary=False,
    )
    session.add(old_contact)

    # Contact for cycle 2 (new, primary)
    new_contact = Contact(
        firm_id=firm.id, company_id=company.id,
        contact_person="Deepa Nair", designation="CEO",
        email="deepa.nair@horizonbiotech-demo.com",
        engagement=Engagement.SELL_SIDE,
        is_primary=True,
    )
    session.add(new_contact)
    session.flush()

    initial_date_c1 = _days_ago(120)
    # Cycle 1 — exhausted, no longer current
    sched1 = OutreachSchedule(
        firm_id=firm.id, company_id=company.id,
        cadence_interval_days=7, cycle_number=1, is_current=False,
        contact_id=old_contact.id,
        status=ScheduleStatus.STOPPED,
        initial_date=initial_date_c1,
        stopped_reason=StoppedReason.EXHAUSTED,
        stopped_at=_utcnow() - timedelta(days=30),
    )
    session.add(sched1)
    session.flush()

    for etype, days_offset in [
        (OutreachEventType.INITIAL_EMAIL, 0),
        (OutreachEventType.FOLLOW_UP, 7),
        (OutreachEventType.FOLLOW_UP, 14),
        (OutreachEventType.FOLLOW_UP, 21),
        (OutreachEventType.FOLLOW_UP, 28),
        (OutreachEventType.NOTE, 32),
    ]:
        session.add(OutreachEvent(
            firm_id=firm.id, company_id=company.id, schedule_id=sched1.id,
            contact_id=old_contact.id if etype != OutreachEventType.NOTE else None,
            event_type=etype,
            occurred_on=initial_date_c1 + timedelta(days=days_offset),
            notes="Cycle 1 — cap exhausted. New contact identified; restart authorised."
                  if etype == OutreachEventType.NOTE else None,
            owner_id=analyst.id,
        ))

    # Cycle 2 — fresh AWAITING_INITIAL, current
    sched2 = OutreachSchedule(
        firm_id=firm.id, company_id=company.id,
        cadence_interval_days=7, cycle_number=2, is_current=True,
        contact_id=new_contact.id,
        status=ScheduleStatus.AWAITING_INITIAL,
    )
    session.add(sched2)
    session.flush()


def _make_contacts(
    session: Session,
    company: Company,
    analyst: User,
    n: int,
) -> int | None:
    """Create n contacts; exactly one is_primary. Returns primary contact id."""
    primary_idx = random.randint(0, n - 1)
    primary_id = None
    for i in range(n):
        name = fake.name()
        is_primary = i == primary_idx
        c = Contact(
            firm_id=company.firm_id,
            company_id=company.id,
            contact_person=name,
            designation=random.choice(DESIGNATIONS),
            email=f"{name.lower().replace(' ', '.')}.{fake.random_int(10, 99)}@{extract_domain(company.website) or 'example.com'}",
            phone=fake.phone_number()[:20],
            engagement=random.choice(list(Engagement)),
            date_connected=_days_ago(random.randint(10, 200)),
            mode=random.choice(list(ContactMode)),
            poc_owner_id=analyst.id,
            is_primary=is_primary,
            remark=fake.sentence(nb_words=6) if random.random() > 0.5 else None,
        )
        session.add(c)
        if is_primary:
            session.flush()
            primary_id = c.id
    return primary_id


def _make_company(
    session: Session,
    firm: Firm,
    mandate: Mandate,
    analyst: User,
    name: str,
    hq: str,
    website: str,
    target_state: str,
    category: CompanyCategory = CompanyCategory.OTHER,
    category_by_code: dict[str, int] | None = None,
    layer_pool: list[int] | None = None,
) -> Company:
    source = random.choice(list(Source))
    category_id = (
        (category_by_code or {}).get(LEGACY_ENUM_TO_CODE.get(category.value, "OTHER"))
    )
    sourcing_layer_id = random.choice(layer_pool) if layer_pool else None
    company = Company(
        firm_id=firm.id,
        mandate_id=mandate.id,
        company_name=name,
        hq=hq,
        type=random.choice([CompanyType.TARGET, CompanyType.BUYER, CompanyType.INVESTOR]),
        status=CompanyStatus.NOT_CONTACTED,
        rationale=fake.sentence(nb_words=10),
        revenue_source="Annual report / public filing",
        revenue_inr_cr=Decimal(str(round(random.uniform(50, 15000), 2))),
        headcount=random.randint(50, 50000),
        website=f"https://www.{website}",
        category=category,
        category_id=category_id,
        sourcing_layer_id=sourcing_layer_id,
        source=source,
        source_quality=random.choice(list(SourceQuality)),
        created_by_id=analyst.id,
    )
    session.add(company)
    session.flush()
    primary_id = _make_contacts(session, company, analyst, random.randint(1, 3))
    session.flush()
    _make_schedule_and_events(
        session, company, analyst, target_state, contact_id=primary_id
    )
    return company


def _pick_state(i: int, total: int) -> str:
    pct = i / total
    if pct < 0.20:
        return "awaiting"
    elif pct < 0.50:
        return "active_ok"
    elif pct < 0.75:
        return "active_overdue"
    else:
        return "stopped"


def _backfill_profiles(session: Session, firm: Firm) -> None:
    """Cluster the firm's companies into shared profiles (mirrors the A2 migration)."""
    companies = (
        session.execute(
            __import__("sqlalchemy").select(Company).where(
                Company.firm_id == firm.id, Company.archived_at.is_(None)
            )
        )
        .scalars()
        .all()
    )
    clusters: dict[tuple, list[Company]] = {}
    for c in companies:
        dk = extract_domain(c.website)
        key = ("d", dk) if dk else ("n", normalise_name(c.company_name or ""))
        clusters.setdefault(key, []).append(c)

    for _key, members in clusters.items():
        def pick(field: str):
            for m in members:
                v = getattr(m, field)
                if v is not None and (not isinstance(v, str) or v.strip()):
                    return v
            return None

        name = pick("company_name") or members[0].company_name
        website = pick("website")
        profile = CompanyProfile(
            firm_id=firm.id,
            company_name=name,
            hq=pick("hq"),
            website=website,
            linkedin=pick("linkedin"),
            headcount=pick("headcount"),
            revenue_source=pick("revenue_source"),
            revenue_inr_cr=pick("revenue_inr_cr"),
            name_key=normalise_name(name or ""),
            domain_key=extract_domain(website),
        )
        session.add(profile)
        session.flush()
        for m in members:
            m.profile_id = profile.id
            for field in STATIC_FACT_FIELDS:
                setattr(m, field, getattr(profile, field))


def run_seed(session: Session) -> None:
    # ── Firm ──────────────────────────────────────────────────────────────────
    firm = Firm(name="Upstream Capital Advisors", follow_up_cap=4)
    session.add(firm)
    session.flush()

    # ── Category vocabulary (§7.2) ────────────────────────────────────────────
    category_by_code: dict[str, int] = {}
    for code, name, sort_order in DEFAULT_CATEGORIES:
        cat = CompanyCategoryVocab(firm_id=firm.id, name=name, code=code, sort_order=sort_order)
        session.add(cat)
        session.flush()
        category_by_code[code] = cat.id

    # ── Sourcing funnel stages (SOURCING_LAYER_PLAN §1) ───────────────────────
    for name, kind, sort_order in DEFAULT_STAGES:
        session.add(
            SourcingStage(firm_id=firm.id, name=name, kind=kind, sort_order=sort_order)
        )
    session.flush()

    # ── Data-source providers (mock seam provable out of the box, §5.1) ────────
    from app.models.data_source_config import DataSourceConfig as _DSC
    from app.services.providers.registry import DEFAULT_DATA_SOURCES

    for provider_key, kind, enabled in DEFAULT_DATA_SOURCES:
        session.add(
            _DSC(firm_id=firm.id, provider_key=provider_key, kind=kind, enabled=enabled, config={})
        )
    session.flush()

    # ── Email starter templates (firm-shared; owner NULL = partner-managed) ───
    from app.models.email_template import EmailTemplate as _ETpl
    from app.models.enums import EmailTemplateKind as _ETKind

    for name, kind, subject, body in EMAIL_TEMPLATES_SPEC:
        session.add(
            _ETpl(
                firm_id=firm.id,
                owner_id=None,
                name=name,
                kind=_ETKind(kind),
                subject=subject,
                body=body,
                is_shared=True,
            )
        )
    session.flush()

    # ── Users ─────────────────────────────────────────────────────────────────
    users: list[User] = []
    for full_name, email, role in USERS_SPEC:
        u = User(
            firm_id=firm.id,
            email=email,
            hashed_password=_hash(DEMO_PASSWORD),
            full_name=full_name,
            role=role,
        )
        session.add(u)
        users.append(u)
    session.flush()

    partner = users[0]

    # ── Projects ──────────────────────────────────────────────────────────────
    projects: dict[str, Project] = {}
    for spec in PROJECTS_SPEC:
        p = Project(
            firm_id=firm.id,
            name=spec["name"],
            client_name=spec["client_name"],
        )
        session.add(p)
        projects[spec["client_name"]] = p
    session.flush()

    # ── Mandates + assignments ────────────────────────────────────────────────
    mandates: list[Mandate] = []
    for spec in MANDATES_SPEC:
        m = Mandate(
            firm_id=firm.id,
            project_id=projects[spec["client_name"]].id,
            client_name=spec["client_name"],
            name=spec["name"],
            type=spec["type"],
            status=MandateStatus.ACTIVE,
            exchange_rate=spec["exchange_rate"],
            exchange_rate_date=spec["exchange_rate_date"],
            lead_owner_id=partner.id,
        )
        session.add(m)
        mandates.append(m)
    session.flush()

    for spec, mandate in zip(MANDATES_SPEC, mandates):
        for idx in spec["assigned_indices"]:
            session.add(MandateAssignment(mandate_id=mandate.id, user_id=users[idx].id))
    session.flush()

    # ── Sourcing layers per engagement (§7.3) ─────────────────────────────────
    layers_by_mandate: dict[int, list[int]] = {}
    for mandate in mandates:
        pool: list[int] = []
        for i, lname in enumerate(DEFAULT_LAYERS_BY_TYPE.get(mandate.type, [])):
            layer = SourcingLayer(
                firm_id=firm.id, mandate_id=mandate.id, name=lname, sort_order=(i + 1) * 10
            )
            session.add(layer)
            session.flush()
            pool.append(layer.id)
        layers_by_mandate[mandate.id] = pool

    def analyst_for(mandate_idx: int) -> User:
        assigned = MANDATES_SPEC[mandate_idx]["assigned_indices"]
        return users[assigned[0]]

    # ── Companies per mandate ────────────────────────────────────────────────
    all_lists = _company_lists()
    dupe_added: set[tuple[int, str]] = set()

    for m_idx, (mandate, co_list) in enumerate(zip(mandates, all_lists)):
        analyst = analyst_for(m_idx)
        random.shuffle(co_list)
        for i, row in enumerate(co_list):
            name, hq, website, category = row
            state = _pick_state(i, len(co_list))
            _make_company(
                session, firm, mandate, analyst, name, hq, website, state, category,
                category_by_code=category_by_code,
                layer_pool=layers_by_mandate.get(mandate.id),
            )
            dupe_added.add((m_idx, name))

    # ── Cross-mandate duplicates ──────────────────────────────────────────────
    for name, website, m_idx_a, m_idx_b in CROSS_MANDATE_DUPES:
        target_mandate_idx = m_idx_b if (m_idx_a, name) in dupe_added else m_idx_a
        mandate = mandates[target_mandate_idx]
        analyst = analyst_for(target_mandate_idx)
        state = random.choice(["awaiting", "active_ok", "stopped"])
        _make_company(
            session, firm, mandate, analyst, name, website, website, state,
            category=CompanyCategory.STRATEGIC,
            category_by_code=category_by_code,
            layer_pool=layers_by_mandate.get(mandate.id),
        )

    # ── Demo: EXHAUSTED (cold) company ───────────────────────────────────────
    cold_mandate = mandates[0]  # Medanta sell-side
    cold_analyst = analyst_for(0)
    cold_company = Company(
        firm_id=firm.id,
        mandate_id=cold_mandate.id,
        company_name="Zephyr Diagnostics (Cold)",
        hq="Chennai",
        type=CompanyType.TARGET,
        status=CompanyStatus.CONTACTED,
        rationale="Hit follow-up cap — no response.",
        website="https://www.zephyrdiag-demo.com",
        category=CompanyCategory.OTHER,
        category_id=category_by_code.get("OTHER"),
        sourcing_layer_id=(layers_by_mandate.get(cold_mandate.id) or [None])[0],
        source=Source.PUBLIC,
        source_quality=SourceQuality.LOW,
        created_by_id=cold_analyst.id,
    )
    session.add(cold_company)
    session.flush()
    # Primary contact for cold company
    cold_contact = Contact(
        firm_id=firm.id, company_id=cold_company.id,
        contact_person="Arun Krishnamurthy", designation="VP Business Development",
        email="arun.k@zephyrdiag-demo.com",
        engagement=Engagement.SELL_SIDE, is_primary=True,
    )
    session.add(cold_contact)
    session.flush()
    _make_exhausted_schedule(session, cold_company, cold_analyst, follow_up_cap=4)

    # ── Demo: RESTARTED company (2 cycles) ────────────────────────────────────
    restart_mandate = mandates[0]  # also Medanta sell-side
    restart_analyst = analyst_for(0)
    _make_restarted_company(session, firm, restart_mandate, restart_analyst)

    session.flush()

    # ── Shared company profiles (§8-A bridge) ─────────────────────────────────
    _backfill_profiles(session, firm)

    session.commit()

    # ── Print summary ─────────────────────────────────────────────────────────
    import sqlalchemy as sa

    def _count(model: type) -> int:
        return session.execute(sa.select(sa.func.count()).select_from(model)).scalar() or 0

    project_count = _count(Project)
    company_count = _count(Company)
    contact_count = _count(Contact)
    schedule_count = _count(OutreachSchedule)
    event_count = _count(OutreachEvent)

    sep = "-" * 65
    print(f"\n{sep}")
    print("  Seed complete")
    print(sep)
    print(f"  Firm:       {firm.name}  (follow_up_cap={firm.follow_up_cap})")
    print(f"  Users:      {len(users)} (1 partner, 4 analysts)")
    print(f"  Projects:   {project_count}")
    print(f"  Mandates:   {len(mandates)} (Medanta is two-sided: sell + buy)")
    print(f"  Companies:  {company_count} (incl. ~8 cross-mandate dupes, 1 cold, 1 restarted)")
    print(f"  Contacts:   {contact_count}")
    print(f"  Schedules:  {schedule_count} (restarted company has 2 cycles)")
    print(f"  Events:     {event_count}")
    print(sep)
    print("Demo logins (password for all: Passw0rd!):")
    for u in users:
        print(f"  {u.role.value:<10}  {u.email}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fabricate a Faker demo book (local SQLite only)."
    )
    parser.add_argument("--reset", action="store_true", help="Wipe all data before seeding.")
    parser.add_argument(
        "--i-know",
        action="store_true",
        help="Allow a non-SQLite target. Fake data in a real database — don't.",
    )
    args = parser.parse_args()

    # A managed Postgres URL here means someone is about to fill a deployed app with
    # invented companies. That has happened; hence the guard rather than a docstring.
    if not settings.sync_database_url.startswith("sqlite") and not args.i_know:
        sys.exit(
            "Refusing to seed fake data into a non-SQLite database "
            f"({settings.sync_database_url.split('://')[0]}://…).\n"
            "A deployment starts empty: run `python -m app.seed.bootstrap --reset` "
            "instead (firm + users + the real company database).\n"
            "Pass --i-know only if you genuinely want demo data in this database."
        )

    import sqlalchemy as sa

    engine = create_engine(settings.sync_database_url, echo=False)
    Base.metadata.create_all(engine)

    with Session(engine) as check_session:
        existing = check_session.execute(sa.select(Firm)).first()

    if existing and not args.reset:
        print("Database already seeded. Use --reset to wipe and re-seed.")
        sys.exit(0)

    if args.reset:
        print("Resetting database...")
        with Session(engine) as reset_session:
            for table in reversed(Base.metadata.sorted_tables):
                reset_session.execute(table.delete())
            reset_session.commit()

    print("Seeding...")
    with Session(engine) as seed_session:
        run_seed(seed_session)


if __name__ == "__main__":
    main()
