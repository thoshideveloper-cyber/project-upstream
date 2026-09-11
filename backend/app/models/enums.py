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


# ── Tasks & activity (PROJECTS_ACTIVITY_TASKS_PLAN) ───────────────────────────


class TaskStatus(str, enum.Enum):
    BACKLOG = "BACKLOG"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    DONE = "DONE"


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class TaskScope(str, enum.Enum):
    """What a task hangs off.

    Every scope but PERSONAL resolves up to a project (see ``services/scope.py``), which
    is what makes "tasks on this project" one indexed predicate instead of four ORs.
    PERSONAL carries no attachment at all and is owner-only, always — including against
    a partner's firm-wide list.
    """

    PROJECT = "PROJECT"
    MANDATE = "MANDATE"
    COMPANY = "COMPANY"
    CONTACT = "CONTACT"
    PERSONAL = "PERSONAL"


class ActivityObjectType(str, enum.Enum):
    PROJECT = "PROJECT"
    MANDATE = "MANDATE"
    COMPANY = "COMPANY"
    CONTACT = "CONTACT"
    TASK = "TASK"
    OUTREACH_EVENT = "OUTREACH_EVENT"
    SCHEDULE = "SCHEDULE"
    IMPORT_BATCH = "IMPORT_BATCH"
    SOURCING_CANDIDATE = "SOURCING_CANDIDATE"
    PROJECT_ASSIGNMENT = "PROJECT_ASSIGNMENT"
    MANDATE_ASSIGNMENT = "MANDATE_ASSIGNMENT"


class ActivityVerb(str, enum.Enum):
    """The activity vocabulary — APPEND-ONLY.

    ``SAEnum(native_enum=False)`` stores the member *name*, so renaming or removing a verb
    makes every historical row raise ``LookupError`` on read. Add members; never edit or
    delete them.
    """

    PROJECT_CREATED = "PROJECT_CREATED"
    PROJECT_UPDATED = "PROJECT_UPDATED"
    PROJECT_ARCHIVED = "PROJECT_ARCHIVED"
    PROJECT_UNARCHIVED = "PROJECT_UNARCHIVED"
    PROJECT_DELETED = "PROJECT_DELETED"
    PROJECT_MEMBER_ADDED = "PROJECT_MEMBER_ADDED"
    PROJECT_MEMBER_REMOVED = "PROJECT_MEMBER_REMOVED"

    MANDATE_CREATED = "MANDATE_CREATED"
    MANDATE_UPDATED = "MANDATE_UPDATED"
    MANDATE_ARCHIVED = "MANDATE_ARCHIVED"
    MANDATE_UNARCHIVED = "MANDATE_UNARCHIVED"
    MANDATE_ASSIGNED = "MANDATE_ASSIGNED"
    MANDATE_UNASSIGNED = "MANDATE_UNASSIGNED"

    COMPANY_CREATED = "COMPANY_CREATED"
    COMPANY_UPDATED = "COMPANY_UPDATED"
    COMPANY_ARCHIVED = "COMPANY_ARCHIVED"
    COMPANY_UNARCHIVED = "COMPANY_UNARCHIVED"
    COMPANY_STATUS_CHANGED = "COMPANY_STATUS_CHANGED"

    CONTACT_CREATED = "CONTACT_CREATED"
    CONTACT_UPDATED = "CONTACT_UPDATED"
    CONTACT_ARCHIVED = "CONTACT_ARCHIVED"

    OUTREACH_LOGGED = "OUTREACH_LOGGED"
    SCHEDULE_UPDATED = "SCHEDULE_UPDATED"
    SCHEDULE_RESTARTED = "SCHEDULE_RESTARTED"
    EMAIL_SENT = "EMAIL_SENT"

    CANDIDATE_ADDED = "CANDIDATE_ADDED"
    CANDIDATE_PUSHED = "CANDIDATE_PUSHED"
    CANDIDATE_STAGE_CHANGED = "CANDIDATE_STAGE_CHANGED"
    IMPORT_APPLIED = "IMPORT_APPLIED"

    TASK_CREATED = "TASK_CREATED"
    TASK_UPDATED = "TASK_UPDATED"
    TASK_ASSIGNED = "TASK_ASSIGNED"
    TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED"
    TASK_ARCHIVED = "TASK_ARCHIVED"
