"""Client-workbook onboarding — preview → validate → apply, over the full CRM graph (WB-1).

``services/imports.py`` seeds the sourcing *pool*: one CSV row → one ``company_profiles``
record. This module is the other half of the story — the partner's three real workbooks
(Master Sheet + Emailing schedule + firm-wide Contact List) carry a whole engagement's
history, so one row here resolves to a profile **and** a per-mandate ``companies`` row,
its inline contacts, its cadence and a *backdated, real* chain of outreach events.

Shape is deliberately identical to the CSV wizard (preview → dedup/validate → idempotent
apply, audited on ``import_batches``/``import_rows``) so the review UX is the same one.

What it will not do:
- **Never invent an anchor.** A Master row whose "Initial email" cell is a text token
  ("Priya Mam reach out") logs no events at all; its schedule stays AWAITING_INITIAL.
- **Never fake precision.** A text-token Status has no date in Excel, so the terminal
  event is dated to the last known follow-up (else the anchor) and flagged APPROXIMATE
  for an analyst to correct.
- **Never mutate history.** Events are appended; re-running resolves to no-ops via the
  (schedule, type, date) key. ``initial_date`` is written once, by ``activate_schedule``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from rapidfuzz import fuzz
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.contact import Contact
from app.models.enums import (
    ContactMode,
    Engagement,
    ImportRowAction,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Sentiment,
    Source,
    StoppedReason,
)
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.sourcing_layer import SourcingLayer
from app.models.user import User
from app.services.cadence import (
    EVENT_STOP_MAP,
    activate_schedule,
    effective_cap,
    get_followups_done,
    recompute_status,
    stop_schedule,
)
from app.services.classification import (
    DEFAULT_CATEGORIES,
    legacy_category_for_code,
    seed_firm_categories,
)
from app.services.profiles import (
    compute_name_key,
    propagate_profile_to_companies,
    sync_company_from_profile,
    upsert_profile,
)
from app.services.sourcing import _TYPE_BY_MANDATE_TYPE
from app.services.workbook_parse import (
    CONTACTS,
    LONGLIST,
    MASTER,
    SCHEDULE,
    UNMAPPED_MASTER_FIELDS,
    ParsedWorkbook,
    ScheduleRow,
    as_date,
    as_int,
    as_revenue,
    clean_text,
    split_email_phone,
)

# The Excel cadence, proven by the data: 4 bi-weekly follow-ups then cold (§2.3).
DEFAULT_CADENCE_INTERVAL_DAYS = 14


# ── Flags — everything the importer had to *decide* rather than read ──────────

CATEGORY_UNMAPPED = "CATEGORY_UNMAPPED"
CATEGORY_APPROXIMATE = "CATEGORY_APPROXIMATE"
BUCKET_SUSPICIOUS = "BUCKET_SUSPICIOUS"
NO_INITIAL_EMAIL = "NO_INITIAL_EMAIL"
APPROXIMATE_DATE = "APPROXIMATE_DATE"
UNCLASSIFIED_STATUS = "UNCLASSIFIED_STATUS"
NO_SCHEDULE_ROW = "NO_SCHEDULE_ROW"
FOLLOWUP_DATE_SYNTHESIZED = "FOLLOWUP_DATE_SYNTHESIZED"
EVENT_BEFORE_INITIAL = "EVENT_BEFORE_INITIAL"
PREVIOUSLY_CONTACTED = "PREVIOUSLY_CONTACTED"
INTRA_FILE_DUPLICATE = "INTRA_FILE_DUPLICATE"
COMPANY_CREATED_FROM_CONTACT = "COMPANY_CREATED_FROM_CONTACT"
POC_UNMATCHED = "POC_UNMATCHED"
UNMAPPED_COLUMN = "UNMAPPED_COLUMN"

FLAG_LABELS: dict[str, str] = {
    CATEGORY_UNMAPPED: "Type not in the firm's category vocabulary — imported as Other",
    CATEGORY_APPROXIMATE: "Type mapped to the closest available category",
    BUCKET_SUSPICIOUS: "Bucket looks like a stray Yes/No, not a sourcing layer",
    NO_INITIAL_EMAIL: "No initial email date — schedule stays Awaiting initial, no events",
    APPROXIMATE_DATE: "Excel had no date for this event — dated to the last known touch",
    UNCLASSIFIED_STATUS: "Status token is neither a response nor a bounce — logged as a note",
    NO_SCHEDULE_ROW: "No matching row on the Emailing schedule tab",
    FOLLOWUP_DATE_SYNTHESIZED: "A follow-up was marked Done with no date — spaced off the anchor",
    EVENT_BEFORE_INITIAL: "Touch predates this company's initial email",
    PREVIOUSLY_CONTACTED: "Marked as previously contacted (warm)",
    INTRA_FILE_DUPLICATE: "Same company appears earlier in this engagement",
    COMPANY_CREATED_FROM_CONTACT: "Company is not on any master sheet — created from this contact",
    POC_UNMATCHED: "POC did not match a user in this firm — owned by the importer",
    UNMAPPED_COLUMN: "Column has no field in the data model — kept in the row's raw record only",
}


# ── Excel vocabularies (PHASE2_REFINEMENT_PLAN §2.2 / §2.4) ───────────────────
# Deterministic aliases first — "PE" scores badly against "Private Equity" on any
# string metric, so the documented short codes get an explicit table and rapidfuzz
# only handles lightly-renamed labels.

_CATEGORY_ALIASES: dict[str, str] = {
    "pe": "PRIVATE_EQUITY",
    "private equity": "PRIVATE_EQUITY",
    "pe fund": "PRIVATE_EQUITY",
    "financial sponsor": "PRIVATE_EQUITY",
    "vc": "VENTURE_CAPITAL",
    "venture capital": "VENTURE_CAPITAL",
    "fo": "FAMILY_OFFICE",
    "family office": "FAMILY_OFFICE",
    "pms": "PMS",
    "strategic": "STRATEGIC",
    "strategics": "STRATEGIC",
    "corporate": "HOLDING_CORPORATE",
    "holding company": "HOLDING_CORPORATE",
    "investment bank": "INVESTMENT_BANK",
    "ib": "INVESTMENT_BANK",
    "private credit": "PRIVATE_CREDIT",
    "pe pc": "PRIVATE_CREDIT",
    "pe/pc": "PRIVATE_CREDIT",
    "pe-pc": "PRIVATE_CREDIT",
}
# Lossy on purpose: a PE/VC crossover fund has no vocabulary entry of its own, so it
# lands on the narrower of the two and the row is flagged for the analyst.
_CATEGORY_APPROXIMATE: dict[str, str] = {
    "pe vc": "VENTURE_CAPITAL",
    "pe/vc": "VENTURE_CAPITAL",
    "pe-vc": "VENTURE_CAPITAL",
}

_ENGAGEMENT_ALIASES: dict[str, Engagement] = {
    "buy side": Engagement.BUY_SIDE,
    "buy-side": Engagement.BUY_SIDE,
    "sell side": Engagement.SELL_SIDE,
    "sell-side": Engagement.SELL_SIDE,
    "fundraise": Engagement.INVESTOR,
    "fund raise": Engagement.INVESTOR,
    "capital raise": Engagement.INVESTOR,
    "investor": Engagement.INVESTOR,
    "advisor": Engagement.ADVISOR,
    "various": Engagement.OTHER,
}

_MODE_ALIASES: dict[str, ContactMode] = {
    "email": ContactMode.EMAIL,
    "e-mail": ContactMode.EMAIL,
    "phone call": ContactMode.CALL,
    "call": ContactMode.CALL,
    "phone": ContactMode.CALL,
    "linkedin": ContactMode.LINKEDIN,
    "meeting": ContactMode.MEETING,
    "event": ContactMode.EVENT,
}

_SENTIMENT_ALIASES: dict[str, Sentiment] = {
    "positive": Sentiment.POSITIVE,
    "negative": Sentiment.NEGATIVE,
    "neutral": Sentiment.NEUTRAL,
}

# Status tokens that STOP the cadence, and what really happened (§2.2).
_RESPONSE_TOKENS = ("got response", "response", "responded", "replied", "reply", "reverted")
_BOUNCE_TOKENS = ("bounce", "bounced", "invalid email", "undeliverable")
_DECLINE_TOKENS = ("not interested", "declined", "decline", "no interest", "passed")

_BOOLEAN_TOKENS = {"yes", "no", "y", "n", "true", "false"}


def _norm(value: Any) -> str:
    text = clean_text(value)
    return text.lower() if text else ""


def classify_status_token(token: str | None) -> tuple[OutreachEventType | None, Sentiment | None]:
    """Map a Status text token → the event it really represents.

    ``None`` event type means "we could not tell" — the caller logs a NOTE carrying the
    verbatim token and flags the row, rather than guessing at a response.
    """
    low = _norm(token)
    if not low:
        return None, None
    if any(t in low for t in _BOUNCE_TOKENS):
        return OutreachEventType.BOUNCE, None
    if any(t in low for t in _DECLINE_TOKENS):
        # There is no DECLINE event type; a decline is a negative response.
        return OutreachEventType.RESPONSE, Sentiment.NEGATIVE
    if any(t in low for t in _RESPONSE_TOKENS):
        return OutreachEventType.RESPONSE, None
    return None, None


def guess_mandate_type(*labels: str | None) -> MandateType:
    """Infer sell-side / buy-side / raise from a sheet or client label."""
    blob = " ".join(_norm(x) for x in labels if x)
    if any(t in blob for t in ("raise", "fundrais", "investor", "capital")):
        return MandateType.CAPITAL_RAISE
    if "sell" in blob or "target" in blob:
        return MandateType.SELL_SIDE
    return MandateType.BUY_SIDE


# ── Plan (step 1 of the wizard — a required manual step, never inferred) ──────


@dataclass
class SheetPlan:
    """What the partner decided to do with one tab."""

    sheet: str
    kind: str = MASTER
    mandate_id: int | None = None
    new_mandate: dict | None = None  # {"name", "type", "exchange_rate"}
    schedule_sheet: str | None = None
    schedule_regarding: str | None = None
    cadence_interval_days: int = DEFAULT_CADENCE_INTERVAL_DAYS

    @classmethod
    def from_dict(cls, data: dict) -> SheetPlan:
        return cls(
            sheet=data["sheet"],
            kind=data.get("kind") or MASTER,
            mandate_id=data.get("mandate_id"),
            new_mandate=data.get("new_mandate"),
            schedule_sheet=data.get("schedule_sheet"),
            schedule_regarding=data.get("schedule_regarding"),
            cadence_interval_days=int(
                data.get("cadence_interval_days") or DEFAULT_CADENCE_INTERVAL_DAYS
            ),
        )

    def to_dict(self) -> dict:
        return {
            "sheet": self.sheet,
            "kind": self.kind,
            "mandate_id": self.mandate_id,
            "new_mandate": self.new_mandate,
            "schedule_sheet": self.schedule_sheet,
            "schedule_regarding": self.schedule_regarding,
            "cadence_interval_days": self.cadence_interval_days,
        }


@dataclass
class WorkbookPlan:
    """One workbook = one client, so the project is chosen once and every mapped tab
    lands on a mandate under it. Sheet names do not reliably encode either, which is
    why this is a wizard step and not an inference (§WB-1 step 3)."""

    project_id: int | None = None
    new_project: dict | None = None  # {"name", "client_name"}
    sheets: list[SheetPlan] = field(default_factory=list)
    # Contact List only: its "Reason" column *is* the client, so it maps to a mandate.
    reason_mandates: dict[str, int | None] = field(default_factory=dict)
    default_mandate_id: int | None = None
    create_missing_companies: bool = True

    @classmethod
    def from_dict(cls, data: dict) -> WorkbookPlan:
        return cls(
            project_id=data.get("project_id"),
            new_project=data.get("new_project"),
            sheets=[SheetPlan.from_dict(s) for s in data.get("sheets") or []],
            reason_mandates=dict(data.get("reason_mandates") or {}),
            default_mandate_id=data.get("default_mandate_id"),
            create_missing_companies=bool(data.get("create_missing_companies", True)),
        )

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "new_project": self.new_project,
            "sheets": [s.to_dict() for s in self.sheets],
            "reason_mandates": self.reason_mandates,
            "default_mandate_id": self.default_mandate_id,
            "create_missing_companies": self.create_missing_companies,
        }

    def for_sheet(self, title: str) -> SheetPlan | None:
        return next((s for s in self.sheets if s.sheet == title), None)


def suggest_plan(parsed: ParsedWorkbook) -> dict:
    """A starting point for the mapping step — the partner still confirms every line."""
    schedule_titles = [s.title for s in parsed.sheets if s.kind == SCHEDULE]
    client_label = next(
        (
            s.client_label
            for s in parsed.sheets
            if s.kind == MASTER and s.client_label and not s.client_label.startswith("[")
        ),
        None,
    )

    sheets: list[dict] = []
    for shape in parsed.sheets:
        if shape.kind == SCHEDULE:
            continue
        # Empty spare tabs and research long-lists default to "leave it" — the partner
        # can still promote a long-list to a master sheet.
        if shape.kind in (CONTACTS,):
            sheets.append(SheetPlan(sheet=shape.title, kind=CONTACTS).to_dict())
            continue
        if shape.kind != MASTER or shape.data_row_count == 0:
            sheets.append(
                SheetPlan(sheet=shape.title, kind="IGNORE").to_dict()
                | {"detected_kind": shape.kind, "row_count": shape.data_row_count}
            )
            continue

        schedule_sheet, regarding = _best_schedule_match(parsed, shape.title, schedule_titles)
        plan = SheetPlan(
            sheet=shape.title,
            kind=MASTER,
            new_mandate={
                "name": shape.title,
                "type": guess_mandate_type(shape.title, shape.client_label, client_label).value,
                "exchange_rate": (
                    float(shape.exchange_rate) if shape.exchange_rate is not None else None
                ),
            },
            schedule_sheet=schedule_sheet,
            schedule_regarding=regarding,
        )
        sheets.append(
            plan.to_dict()
            | {"detected_kind": shape.kind, "row_count": shape.data_row_count}
        )

    reasons: list[str] = []
    for shape in parsed.sheets:
        if shape.kind != CONTACTS:
            continue
        for row in parsed.rows_by_sheet.get(shape.title, []):
            reason = clean_text(row.get("reason"))
            if reason and reason not in reasons:
                reasons.append(reason)

    return {
        "project": {"name": client_label, "client_name": client_label},
        "sheets": sheets,
        "reasons": reasons,
        "schedule_sheets": schedule_titles,
    }


def _best_schedule_match(
    parsed: ParsedWorkbook, master_title: str, schedule_titles: list[str]
) -> tuple[str | None, str | None]:
    """Pick the scheduler tab (and its "Regarding" slice) that actually covers this sheet.

    One Emailing schedule can serve several master sheets — the PE workbook's does, with
    Regarding = PE / Portfolio — so the slice is chosen by company-name overlap, not by
    trusting the label.
    """
    master_keys = {
        compute_name_key(str(r.get("company_name") or ""))
        for r in parsed.rows_by_sheet.get(master_title, [])
        if r.get("company_name")
    }
    if not master_keys:
        return (schedule_titles[0] if schedule_titles else None), None

    best: tuple[float, str | None, str | None] = (0.0, None, None)
    for title in schedule_titles:
        rows = parsed.schedule_rows_by_sheet.get(title, [])
        buckets: dict[str | None, set[str]] = {}
        for sr in rows:
            buckets.setdefault(sr.regarding, set()).add(compute_name_key(sr.company_name))
        # Also consider the whole tab, for schedulers with no Regarding column filled in.
        buckets[None] = buckets.get(None) or set()
        all_keys = {k for keys in buckets.values() for k in keys}
        candidates = list(buckets.items())
        if len(buckets) > 1:
            candidates.append((None, all_keys))
        for regarding, keys in candidates:
            if not keys:
                continue
            overlap = len(master_keys & keys) / len(master_keys)
            if overlap > best[0]:
                best = (overlap, title, regarding)
    if best[0] < 0.3:
        return (schedule_titles[0] if schedule_titles else None), None
    return best[1], best[2]


# ── Row-level resolution shared by preview and apply ─────────────────────────


@dataclass
class RowOutcome:
    """One parsed row's decided plan — computed identically for preview and apply so a
    dry run cannot disagree with what the apply then writes."""

    sheet: str
    # Position *within its sheet* — the stable join key between a preview row and its
    # persisted ``import_rows`` record, which plan re-ordering cannot break.
    row_index: int
    excel_row: int | None
    name: str
    action: str = ImportRowAction.CREATE.value
    message: str | None = None
    flags: list[dict] = field(default_factory=list)
    category_code: str | None = None
    layer_name: str | None = None
    contact_names: list[str] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)

    def flag(self, code: str, detail: str | None = None) -> None:
        self.flags.append({"code": code, "label": FLAG_LABELS.get(code, code), "detail": detail})

    def to_dict(self) -> dict:
        return {
            "sheet": self.sheet,
            "row_index": self.row_index,
            "excel_row": self.excel_row,
            "name": self.name,
            "action": self.action,
            "message": self.message,
            "flags": self.flags,
            "category_code": self.category_code,
            "layer_name": self.layer_name,
            "contacts": self.contact_names,
            "events": self.events,
        }


@dataclass
class PlannedEvent:
    event_type: OutreachEventType
    occurred_on: date
    approximate: bool = False
    notes: str | None = None
    sentiment: Sentiment | None = None
    mode: ContactMode | None = None

    def to_dict(self) -> dict:
        return {
            "type": self.event_type.value,
            "on": self.occurred_on.isoformat(),
            "approximate": self.approximate,
            "notes": self.notes,
        }


def plan_events_for_master_row(
    row: dict, sched_row: ScheduleRow | None, interval_days: int, outcome: RowOutcome
) -> list[PlannedEvent]:
    """Rebuild the real outreach chain for one Master Sheet row.

    Evidence, in order of trust: the Emailing schedule's per-follow-up ``Done`` cells and
    their computed dates, then the Master Sheet's own Initial-email / Status cells. The
    anchor is never guessed — without a real initial date the row logs nothing.
    """
    initial = as_date(row.get("initial_email"))
    if initial is None and sched_row is not None:
        initial = sched_row.initial_date
    if initial is None:
        token = clean_text(row.get("initial_email")) or (
            sched_row.initial_token if sched_row else None
        )
        outcome.flag(NO_INITIAL_EMAIL, token)
        return []

    events: list[PlannedEvent] = [PlannedEvent(OutreachEventType.INITIAL_EMAIL, initial)]

    # Follow-ups: one per "Done" cell, dated from the sheet's own computed column.
    last_touch = initial
    if sched_row is not None:
        for i in range(sched_row.done_count):
            fu_date = (
                sched_row.follow_up_dates[i]
                if i < len(sched_row.follow_up_dates)
                else None
            )
            approximate = fu_date is None
            if approximate:
                fu_date = initial + _days(interval_days * (i + 1))
                outcome.flag(FOLLOWUP_DATE_SYNTHESIZED, f"follow-up #{i + 1}")
            events.append(PlannedEvent(OutreachEventType.FOLLOW_UP, fu_date, approximate))
            last_touch = max(last_touch, fu_date)
    else:
        outcome.flag(NO_SCHEDULE_ROW)
        # No scheduler evidence: a Status *date* is the date of the latest touch (§2.2),
        # which is one real follow-up — not a licence to interpolate a whole chain.
        status_date = as_date(row.get("status"))
        if status_date and status_date > initial:
            events.append(PlannedEvent(OutreachEventType.FOLLOW_UP, status_date))
            last_touch = status_date

    # A text token in Status stops the row. Excel records no date for it.
    status_token = clean_text(row.get("status")) if as_date(row.get("status")) is None else None
    if status_token is None and sched_row is not None:
        status_token = sched_row.status_token
    if status_token:
        event_type, sentiment = classify_status_token(status_token)
        outcome.flag(APPROXIMATE_DATE, f'"{status_token}" has no date in Excel')
        if event_type is None:
            outcome.flag(UNCLASSIFIED_STATUS, status_token)
            events.append(
                PlannedEvent(
                    OutreachEventType.NOTE,
                    last_touch,
                    approximate=True,
                    notes=f"Imported status: {status_token}",
                )
            )
        else:
            events.append(
                PlannedEvent(
                    event_type,
                    last_touch,
                    approximate=True,
                    notes=f"Imported status: {status_token}",
                    sentiment=sentiment,
                )
            )
    return events


def _days(n: int):
    from datetime import timedelta

    return timedelta(days=n)


# ── Category / layer resolution ───────────────────────────────────────────────


def resolve_category_code(
    raw: str | None, vocab: list[CompanyCategoryVocab], outcome: RowOutcome | None = None
) -> str:
    """Excel Type → firm category ``code``. Alias table, then fuzzy, then Other+flag."""
    low = _norm(raw)
    if not low:
        return "OTHER"
    codes = {c.code for c in vocab}

    if low in _CATEGORY_ALIASES and _CATEGORY_ALIASES[low] in codes:
        return _CATEGORY_ALIASES[low]
    if low in _CATEGORY_APPROXIMATE and _CATEGORY_APPROXIMATE[low] in codes:
        if outcome:
            outcome.flag(CATEGORY_APPROXIMATE, f'"{raw}" → {_CATEGORY_APPROXIMATE[low]}')
        return _CATEGORY_APPROXIMATE[low]

    best_code, best_score = None, 0
    for cat in vocab:
        score = max(
            fuzz.ratio(low, cat.name.lower()),
            fuzz.ratio(low, cat.code.replace("_", " ").lower()),
        )
        if score > best_score:
            best_code, best_score = cat.code, score
    if best_code and best_score >= 88:
        return best_code
    if outcome:
        outcome.flag(CATEGORY_UNMAPPED, raw)
    return "OTHER"


def _layer_name(raw: str | None, outcome: RowOutcome | None = None) -> str | None:
    name = clean_text(raw)
    if not name:
        return None
    if name.lower() in _BOOLEAN_TOKENS and outcome:
        outcome.flag(BUCKET_SUSPICIOUS, name)
    return name


# ── Facts extraction ─────────────────────────────────────────────────────────


def master_row_facts(row: dict) -> dict:
    """Master Sheet row → the profile's static facts (§2.2 columns 1–10)."""
    return {
        "company_name": clean_text(row.get("company_name")),
        "hq": clean_text(row.get("hq")),
        "website": clean_text(row.get("website")),
        "linkedin": None,
        "headcount": as_int(row.get("headcount")),
        "revenue_source": clean_text(row.get("revenue_source")),
        "revenue_inr_cr": as_revenue(row.get("revenue_inr_cr")),
    }


def master_row_contacts(row: dict) -> list[dict]:
    """The inline person(s) — *final* sheets carry two (§2.2 columns 11–14)."""
    out: list[dict] = []
    for suffix in ("1", "2"):
        name = clean_text(row.get(f"contact_name_{suffix}"))
        if not name:
            continue
        out.append(
            {
                "contact_person": name,
                "designation": clean_text(row.get(f"designation_{suffix}")),
                "email": clean_text(row.get(f"email_{suffix}")),
                "linkedin": clean_text(row.get(f"linkedin_{suffix}")),
            }
        )
    return out


# ── Lookup caches (one per apply/preview run) ────────────────────────────────


class _Resolver:
    """Per-run caches so a 200-row workbook is a handful of queries, not thousands.

    ``read_only=True`` is the preview mode: it never seeds the firm vocabulary and never
    creates a layer, so a dry run leaves the database exactly as it found it.
    """

    def __init__(self, db: AsyncSession, firm_id: int, actor_id: int, *, read_only: bool = False):
        self.db = db
        self.firm_id = firm_id
        self.actor_id = actor_id
        self.read_only = read_only
        self._vocab: list[CompanyCategoryVocab] | None = None
        self._companies: dict[int, dict[str, Company]] = {}
        self._layers: dict[int, dict[str, SourcingLayer]] = {}
        self._users: list[User] | None = None
        self._pending_layers: dict[int, set[str]] = {}
        self._pending_companies: dict[int, set[str]] = {}

    async def vocab(self) -> list[CompanyCategoryVocab]:
        if self._vocab is not None:
            return self._vocab
        if self.read_only:
            rows = list(
                (
                    await self.db.execute(
                        select(CompanyCategoryVocab).where(
                            CompanyCategoryVocab.firm_id == self.firm_id,
                            CompanyCategoryVocab.archived_at.is_(None),
                        )
                    )
                ).scalars().all()
            )
            if not rows:
                # Not yet seeded — preview against the defaults the apply would create,
                # detached from the session so nothing is written.
                rows = [
                    CompanyCategoryVocab(
                        firm_id=self.firm_id, name=name, code=code, sort_order=order
                    )
                    for code, name, order in DEFAULT_CATEGORIES
                ]
            self._vocab = rows
        else:
            self._vocab = await seed_firm_categories(self.db, self.firm_id)
        return self._vocab

    async def category_id(self, code: str) -> tuple[int | None, str]:
        vocab = await self.vocab()
        match = next((c for c in vocab if c.code == code), None)
        if match is None:
            match = next((c for c in vocab if c.code == "OTHER"), None)
        return (match.id if match else None), (match.code if match else "OTHER")

    async def mandate_companies(self, mandate_id: int) -> dict[str, Company]:
        """{name_key: company} for one engagement — the per-mandate idempotency index."""
        if mandate_id not in self._companies:
            rows = (
                await self.db.execute(
                    select(Company).where(
                        Company.firm_id == self.firm_id,
                        Company.mandate_id == mandate_id,
                        Company.archived_at.is_(None),
                    )
                )
            ).scalars().all()
            self._companies[mandate_id] = {
                compute_name_key(c.company_name): c for c in rows
            }
        return self._companies[mandate_id]

    def remember_company(self, mandate_id: int, company: Company) -> None:
        self._companies.setdefault(mandate_id, {})[
            compute_name_key(company.company_name)
        ] = company

    async def layers(self, mandate_id: int) -> dict[str, SourcingLayer]:
        if mandate_id not in self._layers:
            rows = (
                await self.db.execute(
                    select(SourcingLayer).where(
                        SourcingLayer.mandate_id == mandate_id,
                        SourcingLayer.archived_at.is_(None),
                    )
                )
            ).scalars().all()
            self._layers[mandate_id] = {r.name.strip().lower(): r for r in rows}
        return self._layers[mandate_id]

    async def layer_id(self, mandate_id: int, name: str | None) -> int | None:
        """Find-or-create the engagement's band, preserving first-seen order (§7.3)."""
        if not name:
            return None
        layers = await self.layers(mandate_id)
        key = name.strip().lower()
        if key in layers:
            return layers[key].id
        next_order = (max((r.sort_order for r in layers.values()), default=0) or 0) + 10
        layer = SourcingLayer(
            firm_id=self.firm_id, mandate_id=mandate_id, name=name.strip(), sort_order=next_order
        )
        self.db.add(layer)
        await self.db.flush()
        layers[key] = layer
        return layer.id

    async def would_create_layer(self, mandate_id: int | None, name: str | None) -> bool:
        """Preview-side counterpart of ``layer_id`` — decides, writes nothing."""
        if not name:
            return False
        key = name.strip().lower()
        pending = self._pending_layers.setdefault(mandate_id or 0, set())
        known = (await self.layers(mandate_id)) if mandate_id else {}
        if key in known or key in pending:
            return False
        pending.add(key)
        return True

    def would_create_company(self, mandate_id: int, name_key: str) -> bool:
        """Preview-side "does this row create a company?", remembering earlier rows.

        Apply creates as it goes, so the *second* Contact-List row for a company the
        first row just created is an update. Without this the preview reports a create
        for both and its split disagrees with what the apply actually does — the two
        must agree, because the split is what the partner approves.
        """
        pending = self._pending_companies.setdefault(mandate_id, set())
        if name_key in pending:
            return False
        pending.add(name_key)
        return True

    async def user_for_poc(self, poc: str | None) -> tuple[int, bool]:
        """Match the Excel POC to a firm user; fall back to the importer (flagged)."""
        name = clean_text(poc)
        if not name:
            return self.actor_id, True
        if self._users is None:
            self._users = list(
                (
                    await self.db.execute(
                        select(User).where(
                            User.firm_id == self.firm_id, User.is_active.is_(True)
                        )
                    )
                ).scalars().all()
            )
        low = name.lower()
        for user in self._users:
            full = (user.full_name or "").lower()
            if full == low or low in full.split() or full.split()[:1] == [low]:
                return user.id, False
        best, score = None, 0
        for user in self._users:
            s = fuzz.token_set_ratio(low, (user.full_name or "").lower())
            if s > score:
                best, score = user, s
        if best is not None and score >= 90:
            return best.id, False
        return self.actor_id, True


# ── Project / mandate resolution (the required manual step) ───────────────────


async def resolve_project(
    db: AsyncSession, firm_id: int, plan: WorkbookPlan, actor_id: int
) -> Project:
    if plan.project_id:
        project = (
            await db.execute(
                select(Project).where(
                    Project.id == plan.project_id,
                    Project.firm_id == firm_id,
                    Project.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if project is None:
            raise ValueError("Project not found in this firm")
        return project
    spec = plan.new_project or {}
    name = clean_text(spec.get("name")) or clean_text(spec.get("client_name"))
    client = clean_text(spec.get("client_name")) or name
    if not name:
        raise ValueError("Pick an existing project or name a new one before importing")
    existing = (
        await db.execute(
            select(Project).where(
                Project.firm_id == firm_id,
                func.lower(Project.name) == name.lower(),
                Project.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    project = Project(firm_id=firm_id, name=name, client_name=client, created_by_id=actor_id)
    db.add(project)
    await db.flush()
    return project


async def resolve_mandate(
    db: AsyncSession, firm_id: int, project: Project, sheet_plan: SheetPlan, actor_id: int
) -> Mandate:
    if sheet_plan.mandate_id:
        mandate = (
            await db.execute(
                select(Mandate).where(
                    Mandate.id == sheet_plan.mandate_id,
                    Mandate.firm_id == firm_id,
                    Mandate.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if mandate is None:
            raise ValueError(f"Mandate not found for sheet '{sheet_plan.sheet}'")
        return mandate

    spec = sheet_plan.new_mandate or {}
    name = clean_text(spec.get("name")) or sheet_plan.sheet
    existing = (
        await db.execute(
            select(Mandate).where(
                Mandate.firm_id == firm_id,
                Mandate.project_id == project.id,
                func.lower(Mandate.name) == name.lower(),
                Mandate.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    try:
        mandate_type = MandateType(spec.get("type")) if spec.get("type") else None
    except ValueError:
        mandate_type = None
    rate = spec.get("exchange_rate")
    mandate = Mandate(
        firm_id=firm_id,
        project_id=project.id,
        client_name=project.client_name,
        name=name,
        type=mandate_type or guess_mandate_type(name, project.name),
        status=MandateStatus.ACTIVE,
        exchange_rate=Decimal(str(rate)) if rate not in (None, "") else None,
        lead_owner_id=actor_id,
    )
    db.add(mandate)
    await db.flush()
    # Visibility runs off mandate_assignments, not lead_owner_id, so without this an
    # analyst would import a whole book and then not be able to see it. `create_mandate`
    # auto-assigns its creator for the same reason; an import is the same act.
    db.add(MandateAssignment(mandate_id=mandate.id, user_id=actor_id))
    await db.flush()
    return mandate


# ── Preview (dry run — writes nothing) ────────────────────────────────────────


async def preview_workbook(
    db: AsyncSession,
    *,
    firm_id: int,
    actor_id: int,
    parsed: ParsedWorkbook,
    plan: WorkbookPlan,
) -> dict:
    """Classify every mapped row without writing anything.

    Runs the same resolution the apply does, against the *current* database, so the
    counts the partner approves are the counts they get. The resolver is in read-only
    mode: no vocabulary seeding, no layer creation, no flush of anything new — a dry
    run leaves the database exactly as it found it.
    """
    resolver = _Resolver(db, firm_id, actor_id, read_only=True)
    vocab = await resolver.vocab()
    counts = {
        "companies": {"create": 0, "update": 0},
        "contacts": {"create": 0, "update": 0},
        "events": {"append": 0, "duplicate": 0},
        "layers": {"create": 0},
        "errors": 0,
    }
    flag_counts: dict[str, int] = {}
    rows_out: list[dict] = []
    sheets_out: list[dict] = []

    project = None
    if plan.project_id:
        project = (
            await db.execute(
                select(Project).where(Project.id == plan.project_id, Project.firm_id == firm_id)
            )
        ).scalar_one_or_none()

    for sheet_plan in plan.sheets:
        shape = parsed.shape(sheet_plan.sheet)
        if shape is None or sheet_plan.kind == "IGNORE":
            continue
        rows = parsed.rows_by_sheet.get(sheet_plan.sheet, [])

        if sheet_plan.kind in (MASTER, LONGLIST):
            mandate = None
            if sheet_plan.mandate_id:
                mandate = (
                    await db.execute(
                        select(Mandate).where(
                            Mandate.id == sheet_plan.mandate_id, Mandate.firm_id == firm_id
                        )
                    )
                ).scalar_one_or_none()
            index = await resolver.mandate_companies(mandate.id) if mandate else {}
            sched_index = _schedule_index(parsed, sheet_plan)
            seen: set[str] = set()
            sheet_rows = 0

            for position, row in enumerate(rows):
                name = clean_text(row.get("company_name"))
                outcome = RowOutcome(
                    sheet=sheet_plan.sheet,
                    row_index=position,
                    excel_row=row.get("_excel_row"),
                    name=name or "",
                )
                sheet_rows += 1
                if not name:
                    outcome.action = ImportRowAction.ERROR.value
                    outcome.message = "company_name is required"
                    counts["errors"] += 1
                    rows_out.append(outcome.to_dict())
                    continue

                key = compute_name_key(name)
                if key in seen:
                    outcome.flag(INTRA_FILE_DUPLICATE)
                if key in index or key in seen:
                    counts["companies"]["update"] += 1
                    outcome.action = ImportRowAction.UPDATE.value
                else:
                    counts["companies"]["create"] += 1
                seen.add(key)

                outcome.category_code = resolve_category_code(
                    row.get("category_raw"), vocab, outcome
                )
                layer = _layer_name(row.get("bucket"), outcome)
                outcome.layer_name = layer
                if await resolver.would_create_layer(mandate.id if mandate else None, layer):
                    counts["layers"]["create"] += 1
                if _norm(row.get("previous_contact")) == "yes":
                    outcome.flag(PREVIOUSLY_CONTACTED)

                inline = master_row_contacts(row)
                outcome.contact_names = [c["contact_person"] for c in inline]
                existing_company = index.get(key)
                touch_contact_id: int | None = None
                for i, spec in enumerate(inline):
                    known = (
                        await _match_contact(
                            db, existing_company.id, spec.get("email"), spec["contact_person"]
                        )
                        if existing_company is not None
                        else None
                    )
                    if i == 0 and known is not None:
                        touch_contact_id = known.id
                    counts["contacts"]["update" if known else "create"] += 1

                planned = plan_events_for_master_row(
                    row, sched_index.get(key), sheet_plan.cadence_interval_days, outcome
                )
                outcome.events = [e.to_dict() for e in planned]
                if existing_company is not None:
                    already = await _logged_events(db, existing_company.id)
                    for event in planned:
                        if (event.event_type, event.occurred_on, touch_contact_id) in already:
                            counts["events"]["duplicate"] += 1
                        else:
                            counts["events"]["append"] += 1
                else:
                    counts["events"]["append"] += len(planned)

                for unmapped in UNMAPPED_MASTER_FIELDS:
                    if clean_text(row.get(unmapped)):
                        outcome.flag(UNMAPPED_COLUMN, unmapped)

                for f in outcome.flags:
                    flag_counts[f["code"]] = flag_counts.get(f["code"], 0) + 1
                rows_out.append(outcome.to_dict())

            sheets_out.append(
                {
                    "sheet": sheet_plan.sheet,
                    "kind": sheet_plan.kind,
                    "rows": sheet_rows,
                    "mandate_id": sheet_plan.mandate_id,
                    "mandate_name": mandate.name
                    if mandate
                    else ((sheet_plan.new_mandate or {}).get("name") or sheet_plan.sheet),
                    "mandate_is_new": mandate is None,
                    "schedule_sheet": sheet_plan.schedule_sheet,
                    "schedule_regarding": sheet_plan.schedule_regarding,
                    "schedule_matched": sum(
                        1
                        for r in rows
                        if compute_name_key(str(r.get("company_name") or "")) in sched_index
                    ),
                    "unmapped_headers": shape.unmapped_headers,
                }
            )

        elif sheet_plan.kind == CONTACTS:
            sheet_rows = 0
            for position, row in enumerate(rows):
                outcome = RowOutcome(
                    sheet=sheet_plan.sheet,
                    row_index=position,
                    excel_row=row.get("_excel_row"),
                    name=clean_text(row.get("contact_person")) or "",
                )
                sheet_rows += 1
                company_name = clean_text(row.get("company"))
                person = clean_text(row.get("contact_person"))
                connected = as_date(row.get("date_connected"))
                if not company_name or not person:
                    outcome.action = ImportRowAction.ERROR.value
                    outcome.message = "company and contact_person are required"
                    counts["errors"] += 1
                    rows_out.append(outcome.to_dict())
                    continue
                if connected is None:
                    outcome.action = ImportRowAction.ERROR.value
                    outcome.message = "Date Connected is not a date"
                    counts["errors"] += 1
                    rows_out.append(outcome.to_dict())
                    continue

                reason = clean_text(row.get("reason"))
                mandate_id = _mandate_for_reason(plan, reason)
                if mandate_id is None:
                    outcome.action = ImportRowAction.SKIP.value
                    outcome.message = f'No engagement mapped for Reason "{reason or "—"}"'
                    rows_out.append(outcome.to_dict())
                    continue

                index = await resolver.mandate_companies(mandate_id)
                company_key = compute_name_key(company_name)
                company = index.get(company_key)
                if company is None:
                    if not plan.create_missing_companies:
                        outcome.action = ImportRowAction.SKIP.value
                        outcome.message = f'"{company_name}" is not on any master sheet'
                        rows_out.append(outcome.to_dict())
                        continue
                    outcome.flag(COMPANY_CREATED_FROM_CONTACT, company_name)
                    outcome.category_code = resolve_category_code(
                        row.get("company_type"), vocab, outcome
                    )
                    # Two people at one company: the first row creates it, the second
                    # updates the row the first just made — mirror what apply does.
                    if resolver.would_create_company(mandate_id, company_key):
                        counts["companies"]["create"] += 1
                    else:
                        counts["companies"]["update"] += 1
                    counts["contacts"]["create"] += 1
                    counts["events"]["append"] += 1
                    outcome.action = ImportRowAction.CREATE.value
                else:
                    counts["companies"]["update"] += 1
                    email, _phone = split_email_phone(row.get("email_or_phone"))
                    known = await _match_contact(db, company.id, email, person)
                    counts["contacts"]["update" if known else "create"] += 1
                    outcome.action = (
                        ImportRowAction.UPDATE.value if known else ImportRowAction.CREATE.value
                    )
                    already = await _logged_events(db, company.id)
                    key = (OutreachEventType.RESPONSE, connected, known.id if known else None)
                    if key in already:
                        counts["events"]["duplicate"] += 1
                    else:
                        counts["events"]["append"] += 1
                    sched = await _current_schedule(db, company.id)
                    if sched and sched.initial_date and connected < sched.initial_date:
                        outcome.flag(EVENT_BEFORE_INITIAL, connected.isoformat())

                outcome.contact_names = [person]
                outcome.events = [
                    {
                        "type": OutreachEventType.RESPONSE.value,
                        "on": connected.isoformat(),
                        "approximate": False,
                        "notes": clean_text(row.get("comments")),
                    }
                ]
                _owner, unmatched = await resolver.user_for_poc(row.get("poc"))
                if unmatched:
                    outcome.flag(POC_UNMATCHED, clean_text(row.get("poc")))

                for f in outcome.flags:
                    flag_counts[f["code"]] = flag_counts.get(f["code"], 0) + 1
                rows_out.append(outcome.to_dict())

            sheets_out.append(
                {
                    "sheet": sheet_plan.sheet,
                    "kind": CONTACTS,
                    "rows": sheet_rows,
                    "unmapped_headers": shape.unmapped_headers,
                }
            )

    return {
        "project": {
            "id": project.id if project else None,
            "name": project.name if project else (plan.new_project or {}).get("name"),
            "is_new": project is None,
        },
        "counts": counts,
        "flags": [
            {"code": code, "label": FLAG_LABELS.get(code, code), "count": n}
            for code, n in sorted(flag_counts.items(), key=lambda kv: -kv[1])
        ],
        "sheets": sheets_out,
        "rows": rows_out,
        "total": len(rows_out),
    }


async def _match_contact(
    db: AsyncSession, company_id: int, email: str | None, person: str | None
) -> Contact | None:
    """The contact idempotency key: (company, email) then (company, person)."""
    rows = (
        await db.execute(
            select(Contact).where(
                Contact.company_id == company_id, Contact.archived_at.is_(None)
            )
        )
    ).scalars().all()
    if email:
        match = next((c for c in rows if (c.email or "").lower() == email.lower()), None)
        if match:
            return match
    if person:
        key = person.strip().lower()
        return next((c for c in rows if (c.contact_person or "").strip().lower() == key), None)
    return None


async def _logged_events(db: AsyncSession, company_id: int) -> set[tuple]:
    """{(event_type, occurred_on, contact_id)} already on this company's log — the same
    key ``_append_events`` dedups on, so preview and apply agree on a re-run."""
    return {
        (row[0], row[1], row[2])
        for row in (
            await db.execute(
                select(
                    OutreachEvent.event_type,
                    OutreachEvent.occurred_on,
                    OutreachEvent.contact_id,
                ).where(OutreachEvent.company_id == company_id)
            )
        ).all()
    }


def _mandate_for_reason(plan: WorkbookPlan, reason: str | None) -> int | None:
    """Contact List "Reason" → engagement. "22by7/GAIL" tries each half in turn."""
    if reason:
        if reason in plan.reason_mandates and plan.reason_mandates[reason]:
            return plan.reason_mandates[reason]
        for part in [p.strip() for p in reason.replace(",", "/").split("/") if p.strip()]:
            if plan.reason_mandates.get(part):
                return plan.reason_mandates[part]
    return plan.default_mandate_id


def _schedule_index(parsed: ParsedWorkbook, sheet_plan: SheetPlan) -> dict[str, ScheduleRow]:
    """{company name_key: schedule row} for the slice of the scheduler this sheet owns."""
    if not sheet_plan.schedule_sheet:
        return {}
    rows = parsed.schedule_rows_by_sheet.get(sheet_plan.schedule_sheet, [])
    wanted = sheet_plan.schedule_regarding
    index: dict[str, ScheduleRow] = {}
    for sr in rows:
        if wanted and (sr.regarding or "") != wanted:
            continue
        index.setdefault(compute_name_key(sr.company_name), sr)
    return index


async def _current_schedule(db: AsyncSession, company_id: int) -> OutreachSchedule | None:
    return (
        await db.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id == company_id,
                OutreachSchedule.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()


# ── Apply (idempotent) ────────────────────────────────────────────────────────


async def apply_workbook(
    db: AsyncSession,
    *,
    batch,
    parsed: ParsedWorkbook,
    plan: WorkbookPlan,
    firm_id: int,
    actor_id: int,
    import_rows: list | None = None,
) -> dict:
    """Write the graph. Re-running the same (or a corrected) file resolves to no-ops.

    Idempotency keys, matching how the CSV importer already blocks:
      profile  — domain_key then name_key (``upsert_profile``)
      company  — (mandate, profile) then (mandate, name_key)
      contact  — (company, email) then (company, person)
      event    — (schedule, type, occurred_on)
      layer    — (mandate, lower(name))
    """
    resolver = _Resolver(db, firm_id, actor_id)
    project = await resolve_project(db, firm_id, plan, actor_id)
    batch.project_id = project.id

    summary = {
        "project_id": project.id,
        "project_name": project.name,
        "mandates": [],
        "companies_created": 0,
        "companies_updated": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "events_appended": 0,
        "events_skipped": 0,
        "layers_created": 0,
        "errors": 0,
    }
    # Audit rows are keyed by (sheet, position within sheet), not by a global counter:
    # the plan may visit sheets in a different order than they were staged in.
    rows_by_key: dict[tuple[str, int], Any] = {}
    staged: dict[str, int] = {}
    for staged_row in import_rows or []:
        sheet = staged_row.sheet_name or ""
        position = staged.get(sheet, 0)
        rows_by_key[(sheet, position)] = staged_row
        staged[sheet] = position + 1

    for sheet_plan in plan.sheets:
        shape = parsed.shape(sheet_plan.sheet)
        if shape is None or sheet_plan.kind == "IGNORE":
            continue
        rows = parsed.rows_by_sheet.get(sheet_plan.sheet, [])

        if sheet_plan.kind in (MASTER, LONGLIST):
            mandate = await resolve_mandate(db, firm_id, project, sheet_plan, actor_id)
            layers_before = len(await resolver.layers(mandate.id))
            sched_index = _schedule_index(parsed, sheet_plan)
            created = updated = 0

            for position, row in enumerate(rows):
                import_row = rows_by_key.get((sheet_plan.sheet, position))
                name = clean_text(row.get("company_name"))
                if not name:
                    summary["errors"] += 1
                    _mark(import_row, ImportRowAction.ERROR, "company_name is required")
                    continue

                outcome = RowOutcome(
                    sheet=sheet_plan.sheet,
                    row_index=position,
                    excel_row=row.get("_excel_row"),
                    name=name,
                )
                facts = master_row_facts(row)
                profile = await upsert_profile(db, firm_id, facts, enrich=True)

                index = await resolver.mandate_companies(mandate.id)
                company = index.get(compute_name_key(name))
                if company is None:
                    company = next(
                        (c for c in index.values() if c.profile_id == profile.id), None
                    )
                is_new = company is None
                if is_new:
                    company = Company(
                        firm_id=firm_id,
                        mandate_id=mandate.id,
                        profile_id=profile.id,
                        company_name=name,
                        # Target/Buyer/Investor is derived from the engagement side (BUG-7).
                        type=_TYPE_BY_MANDATE_TYPE[mandate.type],
                        source=Source.IMPORTED,
                        created_by_id=actor_id,
                    )
                    db.add(company)
                    await db.flush()
                    resolver.remember_company(mandate.id, company)
                    created += 1
                else:
                    company.profile_id = company.profile_id or profile.id
                    updated += 1

                # Per-mandate facts the profile does not own (§2.2 columns 6, 15, 16).
                code = resolve_category_code(
                    row.get("category_raw"), await resolver.vocab(), outcome
                )
                category_id, resolved_code = await resolver.category_id(code)
                company.category_id = category_id
                company.category = legacy_category_for_code(resolved_code)
                layer = _layer_name(row.get("bucket"), outcome)
                company.sourcing_layer_id = await resolver.layer_id(mandate.id, layer)
                for target, source_field in (
                    ("rationale", "rationale"),
                    ("relevant_investments", "relevant_investments"),
                ):
                    value = clean_text(row.get(source_field))
                    if value:
                        setattr(company, target, value)
                sync_company_from_profile(company, profile)
                await db.flush()
                await propagate_profile_to_companies(db, profile)

                contact_ids, made, touched = await _upsert_contacts(
                    db, firm_id, company, master_row_contacts(row)
                )
                summary["contacts_created"] += made
                summary["contacts_updated"] += touched

                schedule = await _ensure_schedule(
                    db, firm_id, company, sheet_plan.cadence_interval_days,
                    regarding=clean_text(row.get("regarding")),
                )
                planned = plan_events_for_master_row(
                    row, sched_index.get(compute_name_key(name)),
                    sheet_plan.cadence_interval_days, outcome,
                )
                appended, skipped = await _append_events(
                    db, firm_id, company, schedule,
                    planned, actor_id,
                    contact_id=contact_ids[0] if contact_ids else None,
                )
                summary["events_appended"] += appended
                summary["events_skipped"] += skipped

                await _settle_schedule(db, company, schedule, planned, mandate)
                await recompute_status(db, company)

                _mark(
                    import_row,
                    ImportRowAction.CREATE if is_new else ImportRowAction.UPDATE,
                    None,
                    profile_id=profile.id,
                    company_id=company.id,
                    contact_id=contact_ids[0] if contact_ids else None,
                    schedule_id=schedule.id,
                    flags=outcome.flags,
                )

            summary["companies_created"] += created
            summary["companies_updated"] += updated
            summary["layers_created"] += max(
                0, len(await resolver.layers(mandate.id)) - layers_before
            )
            summary["mandates"].append(
                {"id": mandate.id, "name": mandate.name, "type": mandate.type.value,
                 "sheet": sheet_plan.sheet, "companies": created + updated}
            )

        elif sheet_plan.kind == CONTACTS:
            for position, row in enumerate(rows):
                import_row = rows_by_key.get((sheet_plan.sheet, position))
                result = await _apply_contact_row(
                    db, resolver, plan, row, firm_id, actor_id, summary
                )
                _mark(import_row, result["action"], result.get("message"),
                      company_id=result.get("company_id"),
                      contact_id=result.get("contact_id"),
                      schedule_id=result.get("schedule_id"))

    await db.flush()
    batch.created_count = summary["companies_created"] + summary["contacts_created"]
    batch.updated_count = summary["companies_updated"] + summary["contacts_updated"]
    batch.skipped_count = summary["errors"]
    batch.summary = summary
    return summary


def _mark(
    import_row,
    action: ImportRowAction,
    message: str | None,
    *,
    profile_id: int | None = None,
    company_id: int | None = None,
    contact_id: int | None = None,
    schedule_id: int | None = None,
    flags: list[dict] | None = None,
) -> None:
    if import_row is None:
        return
    import_row.action = action
    if flags:
        detail = "; ".join(f["label"] for f in flags)
        import_row.message = (message + " · " + detail) if message else detail
    else:
        import_row.message = message
    if profile_id:
        import_row.resolved_profile_id = profile_id
    if company_id:
        import_row.resolved_company_id = company_id
    if contact_id:
        import_row.resolved_contact_id = contact_id
    if schedule_id:
        import_row.resolved_schedule_id = schedule_id


async def _upsert_contacts(
    db: AsyncSession, firm_id: int, company: Company, specs: list[dict]
) -> tuple[list[int], int, int]:
    """Inline Master-Sheet people → contacts. First one is primary if none is yet.

    Returns (contact ids in sheet order, created, updated).
    """
    if not specs:
        return [], 0, 0
    existing = list(
        (
            await db.execute(
                select(Contact).where(
                    Contact.company_id == company.id, Contact.archived_at.is_(None)
                )
            )
        ).scalars().all()
    )
    has_primary = any(c.is_primary for c in existing)
    ids: list[int] = []
    created = updated = 0
    for spec in specs:
        person = spec["contact_person"]
        email = spec.get("email")
        match = None
        if email:
            match = next((c for c in existing if (c.email or "").lower() == email.lower()), None)
        if match is None:
            key = person.strip().lower()
            match = next(
                (c for c in existing if (c.contact_person or "").strip().lower() == key), None
            )
        if match is None:
            match = Contact(
                firm_id=firm_id,
                company_id=company.id,
                contact_person=person,
                designation=spec.get("designation"),
                email=email,
                linkedin=spec.get("linkedin"),
                is_primary=not has_primary,
            )
            db.add(match)
            await db.flush()
            existing.append(match)
            has_primary = True
            created += 1
        else:
            for f in ("designation", "email", "linkedin"):
                value = spec.get(f)
                if value and not getattr(match, f):
                    setattr(match, f, value)
            updated += 1
        ids.append(match.id)
    return ids, created, updated


async def _ensure_schedule(
    db: AsyncSession,
    firm_id: int,
    company: Company,
    interval_days: int,
    *,
    regarding: str | None = None,
) -> OutreachSchedule:
    """Find-or-create the company's current cycle. Never touches an existing anchor."""
    schedule = await _current_schedule(db, company.id)
    if schedule is None:
        schedule = OutreachSchedule(
            firm_id=firm_id,
            company_id=company.id,
            cycle_number=1,
            is_current=True,
            status=ScheduleStatus.AWAITING_INITIAL,
            cadence_interval_days=interval_days,
            regarding=regarding,
        )
        db.add(schedule)
        await db.flush()
    elif regarding and not schedule.regarding:
        schedule.regarding = regarding
    return schedule


async def _append_events(
    db: AsyncSession,
    firm_id: int,
    company: Company,
    schedule: OutreachSchedule,
    planned: list[PlannedEvent],
    owner_id: int,
    *,
    contact_id: int | None = None,
) -> tuple[int, int]:
    """Append the chain, skipping anything already logged.

    Dedup key is (schedule, event_type, occurred_on, **contact**). The contact is part
    of it on purpose: two people at the same company replying on the same day are two
    real touches — the Contact List has ten such pairs — while the *same* person on the
    same day is the re-import case that must collapse.

    The append-only log is never edited: a re-import that finds the event already there
    does nothing at all, which is what makes a corrected re-upload safe.
    """
    if not planned:
        return 0, 0
    existing = {
        (row[0], row[1], row[2])
        for row in (
            await db.execute(
                select(
                    OutreachEvent.event_type,
                    OutreachEvent.occurred_on,
                    OutreachEvent.contact_id,
                ).where(
                    OutreachEvent.company_id == company.id,
                    OutreachEvent.schedule_id == schedule.id,
                )
            )
        ).all()
    }
    appended = skipped = 0
    for event in planned:
        key = (event.event_type, event.occurred_on, contact_id)
        if key in existing:
            skipped += 1
            continue
        # initial_date is immutable: only the very first INITIAL_EMAIL ever sets it, so a
        # second one (a corrected file with a different date) must not be appended.
        if event.event_type == OutreachEventType.INITIAL_EMAIL and any(
            t == OutreachEventType.INITIAL_EMAIL for t, _, _ in existing
        ):
            skipped += 1
            continue
        db.add(
            OutreachEvent(
                firm_id=firm_id,
                company_id=company.id,
                schedule_id=schedule.id,
                contact_id=contact_id,
                event_type=event.event_type,
                occurred_on=event.occurred_on,
                regarding=schedule.regarding,
                notes=event.notes,
                mode=event.mode,
                sentiment=event.sentiment,
                owner_id=owner_id,
            )
        )
        existing.add(key)
        appended += 1
    await db.flush()
    return appended, skipped


async def _settle_schedule(
    db: AsyncSession,
    company: Company,
    schedule: OutreachSchedule,
    planned: list[PlannedEvent],
    mandate: Mandate,
) -> None:
    """Drive the schedule through the same transitions ``log_event`` would have."""
    initial = next(
        (e for e in planned if e.event_type == OutreachEventType.INITIAL_EMAIL), None
    )
    if initial is not None:
        await activate_schedule(db, schedule, initial.occurred_on)

    stopper = next((e for e in planned if e.event_type in EVENT_STOP_MAP), None)
    if stopper is not None:
        await stop_schedule(db, schedule, EVENT_STOP_MAP[stopper.event_type])
        return

    if schedule.status == ScheduleStatus.ACTIVE:
        from app.models.firm import Firm

        firm = (
            await db.execute(select(Firm).where(Firm.id == company.firm_id))
        ).scalar_one()
        if await get_followups_done(db, schedule.id) >= effective_cap(firm, mandate):
            await stop_schedule(db, schedule, StoppedReason.EXHAUSTED)


async def _apply_contact_row(
    db: AsyncSession,
    resolver: _Resolver,
    plan: WorkbookPlan,
    row: dict,
    firm_id: int,
    actor_id: int,
    summary: dict,
) -> dict:
    """Contact List row → firm-wide contact + one touch carrying its context (§8-B).

    The context lives on the *event*; the contact row is identity plus a latest-touch
    cache — the mechanism Slice A4 already built, reused rather than reinvented.
    """
    company_name = clean_text(row.get("company"))
    person = clean_text(row.get("contact_person"))
    if not company_name or not person:
        summary["errors"] += 1
        return {
            "action": ImportRowAction.ERROR,
            "message": "company and contact_person are required",
        }

    connected = as_date(row.get("date_connected"))
    if connected is None:
        summary["errors"] += 1
        return {"action": ImportRowAction.ERROR, "message": "Date Connected is not a date"}

    reason = clean_text(row.get("reason"))
    mandate_id = _mandate_for_reason(plan, reason)
    if mandate_id is None:
        return {
            "action": ImportRowAction.SKIP,
            "message": f'No engagement mapped for Reason "{reason or "—"}"',
        }
    mandate = (
        await db.execute(
            select(Mandate).where(Mandate.id == mandate_id, Mandate.firm_id == firm_id)
        )
    ).scalar_one_or_none()
    if mandate is None:
        return {"action": ImportRowAction.ERROR, "message": "Mapped engagement not found"}

    index = await resolver.mandate_companies(mandate.id)
    company = index.get(compute_name_key(company_name))
    if company is None:
        if not plan.create_missing_companies:
            return {
                "action": ImportRowAction.SKIP,
                "message": f'"{company_name}" is not on any master sheet',
            }
        facts = {
            "company_name": company_name,
            "hq": None, "website": None, "linkedin": None,
            "headcount": None, "revenue_source": None, "revenue_inr_cr": None,
        }
        profile = await upsert_profile(db, firm_id, facts, enrich=True)
        code = resolve_category_code(row.get("company_type"), await resolver.vocab())
        category_id, resolved_code = await resolver.category_id(code)
        company = Company(
            firm_id=firm_id,
            mandate_id=mandate.id,
            profile_id=profile.id,
            company_name=company_name,
            type=_TYPE_BY_MANDATE_TYPE[mandate.type],
            category_id=category_id,
            category=legacy_category_for_code(resolved_code),
            source=Source.IMPORTED,
            created_by_id=actor_id,
        )
        sync_company_from_profile(company, profile)
        db.add(company)
        await db.flush()
        resolver.remember_company(mandate.id, company)
        summary["companies_created"] += 1
    else:
        summary["companies_updated"] += 1

    email, phone = split_email_phone(row.get("email_or_phone"))
    engagement = _ENGAGEMENT_ALIASES.get(_norm(row.get("engagement")))
    mode = _MODE_ALIASES.get(_norm(row.get("mode")))
    sentiment = _SENTIMENT_ALIASES.get(_norm(row.get("remark")))
    comments = clean_text(row.get("comments"))
    owner_id, _ = await resolver.user_for_poc(row.get("poc"))

    contact = await _match_contact(db, company.id, email, person)
    is_new_contact = contact is None
    if contact is None:
        has_primary = (
            await db.execute(
                select(Contact.id).where(
                    Contact.company_id == company.id,
                    Contact.is_primary.is_(True),
                    Contact.archived_at.is_(None),
                )
            )
        ).first() is not None
        contact = Contact(
            firm_id=firm_id,
            company_id=company.id,
            contact_person=person,
            is_primary=not has_primary,
        )
        db.add(contact)
        summary["contacts_created"] += 1
    else:
        summary["contacts_updated"] += 1
    for field_name, value in (
        ("designation", clean_text(row.get("designation"))),
        ("email", email),
        ("phone", phone),
    ):
        if value and not getattr(contact, field_name):
            setattr(contact, field_name, value)
    contact.poc_owner_id = owner_id
    await db.flush()

    schedule = await _ensure_schedule(
        db, firm_id, company, DEFAULT_CADENCE_INTERVAL_DAYS, regarding=reason
    )
    appended, skipped = await _append_events(
        db, firm_id, company, schedule,
        [
            PlannedEvent(
                OutreachEventType.RESPONSE,
                connected,
                notes=comments,
                sentiment=sentiment,
                mode=mode,
            )
        ],
        owner_id,
        contact_id=contact.id,
    )
    summary["events_appended"] += appended
    summary["events_skipped"] += skipped

    if appended:
        # The touch stops the cadence, exactly as a RESPONSE logged in the app does.
        await stop_schedule(db, schedule, EVENT_STOP_MAP[OutreachEventType.RESPONSE])
        # Latest-touch cache on the contact row (§8-B) — the event stays the truth.
        if engagement is not None:
            contact.engagement = engagement
        if mode is not None:
            contact.mode = mode
        if sentiment is not None:
            contact.sentiment = sentiment
        if reason:
            contact.reason = reason
        remark = clean_text(row.get("remark"))
        if remark:
            contact.remark = remark
        contact.date_connected = connected
        if comments and comments not in (contact.comments or ""):
            # Running free-text log (§2.4 Comments) — appended, never overwritten.
            contact.comments = (
                contact.comments + "\n" + comments if contact.comments else comments
            )
        if contact.last_contact_date is None or connected > contact.last_contact_date:
            contact.last_contact_date = connected
    await recompute_status(db, company)

    return {
        "action": ImportRowAction.CREATE if is_new_contact else ImportRowAction.UPDATE,
        "company_id": company.id,
        "contact_id": contact.id,
        "schedule_id": schedule.id,
    }
