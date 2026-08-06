from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    ANALYST = "ANALYST"
    PARTNER = "PARTNER"


class MandateType(str, enum.Enum):
    SELL_SIDE = "SELL_SIDE"
    BUY_SIDE = "BUY_SIDE"
    CAPITAL_RAISE = "CAPITAL_RAISE"


class MandateStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    CLOSED = "CLOSED"
    TERMINATED = "TERMINATED"


class CompanyType(str, enum.Enum):
    TARGET = "TARGET"
    BUYER = "BUYER"
    INVESTOR = "INVESTOR"


class CompanyStatus(str, enum.Enum):
    NOT_CONTACTED = "NOT_CONTACTED"
    CONTACTED = "CONTACTED"
    RESPONDED = "RESPONDED"
    INTERESTED = "INTERESTED"
    DECLINED = "DECLINED"
    BOUNCED = "BOUNCED"


class Source(str, enum.Enum):
    PROPRIETARY = "PROPRIETARY"
    PUBLIC = "PUBLIC"
    REFERRAL = "REFERRAL"
    IMPORTED = "IMPORTED"


class SourceQuality(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Engagement(str, enum.Enum):
    BUY_SIDE = "BUY_SIDE"
    SELL_SIDE = "SELL_SIDE"
    INVESTOR = "INVESTOR"
    ADVISOR = "ADVISOR"
    OTHER = "OTHER"


class ContactMode(str, enum.Enum):
    EMAIL = "EMAIL"
    CALL = "CALL"
    LINKEDIN = "LINKEDIN"
    MEETING = "MEETING"
    EVENT = "EVENT"


class ScheduleStatus(str, enum.Enum):
    AWAITING_INITIAL = "AWAITING_INITIAL"
    ACTIVE = "ACTIVE"
    STOPPED = "STOPPED"


class OutreachEventType(str, enum.Enum):
    INITIAL_EMAIL = "INITIAL_EMAIL"
    FOLLOW_UP = "FOLLOW_UP"
    RESPONSE = "RESPONSE"
    BOUNCE = "BOUNCE"
    CALL = "CALL"
    LINKEDIN = "LINKEDIN"
    MEETING = "MEETING"
    NOTE = "NOTE"


class CompanyCategory(str, enum.Enum):
    STRATEGIC = "STRATEGIC"
    PRIVATE_EQUITY = "PRIVATE_EQUITY"
    VENTURE_CAPITAL = "VENTURE_CAPITAL"
    FAMILY_OFFICE = "FAMILY_OFFICE"
    FINANCIAL_SPONSOR = "FINANCIAL_SPONSOR"
    OTHER = "OTHER"


class Sentiment(str, enum.Enum):
    """Outcome of a touch — the Excel 'Remark' column, typed (BUG-12)."""

    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    NEUTRAL = "NEUTRAL"


class StoppedReason(str, enum.Enum):
    RESPONDED = "RESPONDED"
    BOUNCED = "BOUNCED"
    DECLINED = "DECLINED"
    TERMINATED = "TERMINATED"
    MANUAL = "MANUAL"
    EXHAUSTED = "EXHAUSTED"  # follow-up cap reached; cadence goes COLD


# ── Email pipeline (analyst mailbox connection) ───────────────────────────────


class EmailProvider(str, enum.Enum):
    GOOGLE = "GOOGLE"
    MICROSOFT = "MICROSOFT"
    SANDBOX = "SANDBOX"  # simulated sends — full pipeline, no external network


class EmailSendStatus(str, enum.Enum):
    SENT = "SENT"
    SIMULATED = "SIMULATED"
    FAILED = "FAILED"


class EmailTemplateKind(str, enum.Enum):
    INITIAL = "INITIAL"
    FOLLOW_UP = "FOLLOW_UP"
    BUMP = "BUMP"       # short nudge
    BREAKUP = "BREAKUP"  # closing-the-loop final touch


# ── Sourcing layer (SOURCING_LAYER_PLAN) ──────────────────────────────────────


class SourcingStageKind(str, enum.Enum):
    """Behaviour of a funnel stage is DERIVED from its kind, not free booleans
    (SOURCING_LAYER_PLAN §2.1) — so a partner can rename/reorder a stage without
    breaking the transition logic.

    RESEARCH / SHORTLIST are pre-placement (candidate-only, no cadence). ACTIVE is the
    single cadence-start (the "push") transition. ENGAGED aligns with a RESPONSE event.
    PASSED is the terminal stage. CUSTOM carries no special behaviour.
    """

    RESEARCH = "RESEARCH"
    SHORTLIST = "SHORTLIST"
    ACTIVE = "ACTIVE"
    ENGAGED = "ENGAGED"
    PASSED = "PASSED"
    CUSTOM = "CUSTOM"


class CandidateScoreStatus(str, enum.Enum):
    """State of the folded AI score cache on a sourcing candidate (§5.5)."""

    OK = "OK"
    STALE = "STALE"
    FAILED = "FAILED"


class SavedSearchScope(str, enum.Enum):
    PRIVATE = "PRIVATE"
    FIRM = "FIRM"


class ImportSource(str, enum.Enum):
    CSV = "CSV"
    IB_DB = "IB_DB"
    PROVIDER = "PROVIDER"
    # Client Excel workbook onboarding (WB-1) — writes the full CRM graph
    # (profiles + per-mandate companies + contacts + backdated outreach events),
    # not just the sourcing pool that CSV/IB_DB feed.
    WORKBOOK = "WORKBOOK"


class ImportStatus(str, enum.Enum):
    PENDING = "PENDING"
    PREVIEWED = "PREVIEWED"
    APPLIED = "APPLIED"
    FAILED = "FAILED"


class ImportRowAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    SKIP = "SKIP"
    ERROR = "ERROR"


class DataSourceKind(str, enum.Enum):
    ENRICHMENT = "ENRICHMENT"
    RANKING = "RANKING"
