/**
 * Activity phrasing and grouping — React-free and unit-testable.
 *
 * The feed reads as sentences, not as an event dump:
 *
 *     Rhea Kapoor  logged an initial email  ·  Acme Industries
 *
 * so each verb carries the middle clause and nothing else. `object_label` is a snapshot
 * taken at write time (a renamed company keeps the name it had, which is correct for an
 * append-only log), and the phrase must therefore work as a standalone predicate — never
 * "was renamed to X", which would contradict the snapshot beside it.
 */

import { parseServerDate } from "@/lib/format";
import type { ActivityEvent, ActivityVerb } from "@/types";

export type ActivityGroup = "DEAL" | "OUTREACH" | "DATA" | "PEOPLE";
export type ActivityTone = "deal" | "outreach" | "data" | "people" | "danger";

export interface VerbMeta {
  /** The middle clause. Present tense, no subject, no object. */
  phrase: string;
  group: ActivityGroup;
  tone: ActivityTone;
  /** lucide-react icon name, resolved by the component. */
  icon: string;
}

export const VERB_META: Record<string, VerbMeta> = {
  PROJECT_CREATED: { phrase: "opened the project", group: "DEAL", tone: "deal", icon: "FolderPlus" },
  PROJECT_UPDATED: { phrase: "edited the project", group: "DEAL", tone: "deal", icon: "Pencil" },
  PROJECT_ARCHIVED: { phrase: "archived the project", group: "DEAL", tone: "deal", icon: "Archive" },
  PROJECT_UNARCHIVED: { phrase: "restored the project", group: "DEAL", tone: "deal", icon: "ArchiveRestore" },
  PROJECT_DELETED: { phrase: "permanently deleted the project", group: "DEAL", tone: "danger", icon: "Trash2" },
  PROJECT_MEMBER_ADDED: { phrase: "added a member", group: "PEOPLE", tone: "people", icon: "UserPlus" },
  PROJECT_MEMBER_REMOVED: { phrase: "removed a member", group: "PEOPLE", tone: "people", icon: "UserMinus" },

  MANDATE_CREATED: { phrase: "opened an engagement", group: "DEAL", tone: "deal", icon: "Briefcase" },
  MANDATE_UPDATED: { phrase: "edited an engagement", group: "DEAL", tone: "deal", icon: "Pencil" },
  MANDATE_ARCHIVED: { phrase: "archived an engagement", group: "DEAL", tone: "deal", icon: "Archive" },
  MANDATE_UNARCHIVED: { phrase: "restored an engagement", group: "DEAL", tone: "deal", icon: "ArchiveRestore" },
  MANDATE_ASSIGNED: { phrase: "assigned an analyst", group: "PEOPLE", tone: "people", icon: "UserPlus" },
  MANDATE_UNASSIGNED: { phrase: "unassigned an analyst", group: "PEOPLE", tone: "people", icon: "UserMinus" },

  COMPANY_CREATED: { phrase: "added a company", group: "DATA", tone: "data", icon: "Building2" },
  COMPANY_UPDATED: { phrase: "edited a company", group: "DATA", tone: "data", icon: "Pencil" },
  COMPANY_ARCHIVED: { phrase: "archived a company", group: "DATA", tone: "data", icon: "Archive" },
  COMPANY_UNARCHIVED: { phrase: "restored a company", group: "DATA", tone: "data", icon: "ArchiveRestore" },
  COMPANY_STATUS_CHANGED: { phrase: "changed the status", group: "OUTREACH", tone: "outreach", icon: "CircleDot" },

  CONTACT_CREATED: { phrase: "added a contact", group: "DATA", tone: "data", icon: "UserRound" },
  CONTACT_UPDATED: { phrase: "edited a contact", group: "DATA", tone: "data", icon: "Pencil" },
  CONTACT_ARCHIVED: { phrase: "archived a contact", group: "DATA", tone: "data", icon: "Archive" },

  OUTREACH_LOGGED: { phrase: "logged a touch", group: "OUTREACH", tone: "outreach", icon: "Send" },
  SCHEDULE_UPDATED: { phrase: "changed the cadence", group: "OUTREACH", tone: "outreach", icon: "CalendarClock" },
  SCHEDULE_RESTARTED: { phrase: "restarted the cadence", group: "OUTREACH", tone: "outreach", icon: "RotateCcw" },
  EMAIL_SENT: { phrase: "sent an email", group: "OUTREACH", tone: "outreach", icon: "Mail" },

  CANDIDATE_ADDED: { phrase: "shortlisted a candidate", group: "DATA", tone: "data", icon: "Target" },
  CANDIDATE_PUSHED: { phrase: "pushed a candidate into the book", group: "DATA", tone: "data", icon: "ArrowRightToLine" },
  CANDIDATE_STAGE_CHANGED: { phrase: "moved a candidate", group: "DATA", tone: "data", icon: "MoveRight" },
  IMPORT_APPLIED: { phrase: "applied an import", group: "DATA", tone: "data", icon: "FileSpreadsheet" },

  TASK_CREATED: { phrase: "added a task", group: "PEOPLE", tone: "people", icon: "CheckSquare" },
  TASK_UPDATED: { phrase: "edited a task", group: "PEOPLE", tone: "people", icon: "Pencil" },
  TASK_ASSIGNED: { phrase: "assigned a task", group: "PEOPLE", tone: "people", icon: "UserPlus" },
  TASK_STATUS_CHANGED: { phrase: "moved a task", group: "PEOPLE", tone: "people", icon: "MoveRight" },
  TASK_ARCHIVED: { phrase: "archived a task", group: "PEOPLE", tone: "people", icon: "Archive" },
};

const FALLBACK: VerbMeta = {
  phrase: "made a change",
  group: "DATA",
  tone: "data",
  icon: "Activity",
};

/**
 * The vocabulary is append-only server-side, but an old client can still meet a verb it
 * has never heard of after a deploy. Falling back beats rendering `TASK_SPLINED`.
 */
export function verbMeta(verb: ActivityVerb | string): VerbMeta {
  return VERB_META[verb] ?? FALLBACK;
}

export const VERB_GROUPS: { key: ActivityGroup; label: string }[] = [
  { key: "DEAL", label: "Deal" },
  { key: "OUTREACH", label: "Outreach" },
  { key: "DATA", label: "Data" },
  { key: "PEOPLE", label: "People" },
];

/**
 * The full sentence's middle clause, specialised where the meta alone is too vague.
 *
 * There is no `TASK_COMPLETED` verb by design — completion is a status change carrying
 * `{from, to}` — so the renderer is where "moved a task" becomes "completed a task".
 * Likewise an outreach touch says which kind it was.
 */
export function phraseFor(event: Pick<ActivityEvent, "verb" | "meta">): string {
  const meta = verbMeta(event.verb);
  const m = (event.meta ?? {}) as Record<string, unknown>;

  if (event.verb === "TASK_STATUS_CHANGED") {
    const to = typeof m.to === "string" ? m.to : null;
    if (to === "DONE") return "completed a task";
    if (to === "BLOCKED") return "blocked a task";
    if (to === "IN_PROGRESS") return "started a task";
    if (to === "BACKLOG") return "reopened a task";
  }

  if (event.verb === "OUTREACH_LOGGED" && typeof m.event_type === "string") {
    const kind: Record<string, string> = {
      INITIAL_EMAIL: "logged an initial email",
      FOLLOW_UP: "logged a follow-up",
      RESPONSE: "logged a reply",
      BOUNCE: "logged a bounce",
      CALL: "logged a call",
      LINKEDIN: "logged a LinkedIn touch",
      MEETING: "logged a meeting",
      NOTE: "left a note",
    };
    return kind[m.event_type] ?? meta.phrase;
  }

  return meta.phrase;
}

/** "Rhea Kapoor added a task" — the actor half, with a graceful unknown. */
export function actorName(event: Pick<ActivityEvent, "actor_name">): string {
  return event.actor_name?.trim() || "Someone";
}

/* ── Grouping ─────────────────────────────────────────────────────────────── */

export interface ActivityDay {
  /** `YYYY-MM-DD`, the local calendar day. */
  key: string;
  /** "Today" / "Yesterday" / "12 Mar 2026". */
  label: string;
  events: ActivityEvent[];
}

/**
 * Day-grouped, newest day first, preserving the server's within-day ordering.
 *
 * Grouping is by the viewer's **local** calendar day, not UTC: "today" means the day the
 * person reading is having.
 */
export function groupByDay(events: ActivityEvent[], now = new Date()): ActivityDay[] {
  const days = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const key = localDayKey(e.created_at);
    const bucket = days.get(key);
    if (bucket) bucket.push(e);
    else days.set(key, [e]);
  }

  const todayKey = localDayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDayKey(yesterday.toISOString());

  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label:
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : formatDayLabel(key),
      events: list,
    }));
}

function localDayKey(iso: string): string {
  // Through the same UTC-aware parser: a naive server timestamp read as local time can
  // land a row on the wrong calendar day, which is how an event lands under "Yesterday"
  // moments after it happens.
  const d = parseServerDate(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Counts per group, for the filter chips ("All 136 · Deal 19 · Outreach 12 …"). */
export function countByGroup(events: ActivityEvent[]): Record<ActivityGroup, number> {
  const out: Record<ActivityGroup, number> = { DEAL: 0, OUTREACH: 0, DATA: 0, PEOPLE: 0 };
  for (const e of events) out[verbMeta(e.verb).group] += 1;
  return out;
}

/**
 * Where a row's object link should point, or null when there is nothing to open.
 *
 * A `PROJECT_DELETED` tombstone deliberately links nowhere: the thing it names no longer
 * exists, and a 404 is a worse answer than no link.
 */
export function linkFor(event: ActivityEvent): string | null {
  if (event.verb === "PROJECT_DELETED") return null;
  if (event.company_id) return `/companies/${event.company_id}`;
  if (event.project_id) return `/projects/${event.project_id}`;
  return null;
}
