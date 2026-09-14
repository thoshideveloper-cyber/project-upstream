/**
 * Small formatting helpers that more than one screen needs.
 *
 * These were copy-pasted between `projects/page.tsx` and `projects/[id]/page.tsx`
 * (and, in the case of initials, a third time in `contacts/page.tsx`). Three copies
 * of a date formatter is three chances for two screens to disagree about what
 * "12 Mar" looks like.
 *
 * React-free on purpose, so it is unit-testable without a renderer.
 */

export const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Parse a timestamp from the API, treating a naive one as UTC.
 *
 * The backend's house convention splits (see `app/core/time.py`): `created_at` /
 * `updated_at` are **naive** columns with a `server_default`, and the value they hold is
 * UTC — but the JSON carries no offset, so `new Date("2026-09-06T05:21:19")` parses it
 * as the *browser's* local time. In IST that shifts every timestamp 5½ hours into the
 * past, and a row written one second ago renders as "5h".
 *
 * `archived_at` / `completed_at` are `DateTime(timezone=True)` and arrive with an
 * offset, so the guard only appends `Z` when there is genuinely no designator.
 */
export function parseServerDate(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  // Date-only values ("2026-03-05") are calendar dates, not instants — leave them be.
  const isDateOnly = !iso.includes("T");
  return new Date(hasZone || isDateOnly ? iso : `${iso}Z`);
}

/** `2026-03-12` → `12 Mar`. Returns an em dash for null/unparseable input. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** `2026-03-12` → `12 Mar 2026`, for anything that may be from another year. */
export function fmtDateFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "just now" / "4h" / "3d" / "12 Mar". Used by the activity feed, where a row's age
 * matters more than its exact timestamp until it stops being recent.
 */
export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const d = parseServerDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return fmtDate(iso);
}

/** "Rhea Kapoor" → "RK". At most two letters; empty input gives "?". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "?";
}
