import type { Company, CompanyStatus } from "@/types";

/**
 * The outreach pipeline, as a board.
 *
 * The point of this module is that **a column is not a field you can write.**
 * NOT_CONTACTED / CONTACTED / RESPONDED / BOUNCED are *derived* from the
 * append-only event log (`recompute_status` on the server is their only writer),
 * while INTERESTED / DECLINED are deliberate manual overrides. So dropping a card
 * cannot mean "set status" — it has to mean either "log the touch that would put
 * it there" or "flag it by hand", and some drops mean nothing legal at all.
 *
 * Everything here is pure so those rules are unit-tested rather than trusted.
 * See CLAUDE.md rules 1 (append-only), 2 (server-computed cadence) and 4 (stops).
 */

export const PIPELINE_COLUMNS = [
  {
    id: "NOT_CONTACTED",
    label: "Not contacted",
    hint: "No email logged yet",
    dot: "bg-muted-foreground/40",
    edge: "border-l-muted-foreground/40",
  },
  {
    id: "CONTACTED",
    label: "In cadence",
    hint: "Chasing on schedule",
    dot: "bg-sky-500",
    edge: "border-l-sky-500/70",
  },
  {
    id: "RESPONDED",
    label: "Replied",
    hint: "Cadence stopped — they answered",
    dot: "bg-emerald-500",
    edge: "border-l-emerald-500/70",
  },
  {
    id: "INTERESTED",
    label: "Interested",
    hint: "Flagged warm by hand",
    dot: "bg-violet-500",
    edge: "border-l-violet-500/70",
  },
  {
    id: "DECLINED",
    label: "Declined",
    hint: "Closed by hand",
    dot: "bg-amber-500",
    edge: "border-l-amber-500/70",
  },
  {
    id: "BOUNCED",
    label: "Bounced",
    hint: "Cadence stopped — undeliverable",
    dot: "bg-destructive",
    edge: "border-l-destructive/70",
  },
] as const satisfies readonly {
  id: CompanyStatus;
  label: string;
  hint: string;
  dot: string;
  edge: string;
}[];

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];
export type PipelineColumnId = PipelineColumn["id"];

export const COLUMN_IDS = PIPELINE_COLUMNS.map((c) => c.id) as readonly PipelineColumnId[];

/** Status written by hand rather than derived from the log (server: `_MANUAL_TERMINAL`). */
const MANUAL: readonly CompanyStatus[] = ["INTERESTED", "DECLINED"];
/** Status a logged event asserts as fact — the board must never overwrite one. */
const EVENT_DERIVED: readonly CompanyStatus[] = ["RESPONDED", "BOUNCED"];

/** What dropping a card actually does. `event` hands off to the log-outreach dialog. */
export type BoardMove =
  | { kind: "noop" }
  | { kind: "refused"; reason: string }
  | {
      kind: "event";
      /** Prefilled event type for the log dialog — the dialog commits, not the drag. */
      eventType: "INITIAL_EMAIL" | "RESPONSE" | "BOUNCE";
      /** Said on the dialog hand-off so the consequence is never a surprise. */
      consequence: string;
    }
  | {
      kind: "status";
      status: Extract<CompanyStatus, "CONTACTED" | "INTERESTED" | "DECLINED">;
      /** Stops the cadence, so it asks first. */
      confirm: { title: string; description: string; confirmText: string } | null;
      /** Reversible by hand, so the toast offers an undo. */
      undoable: boolean;
    };

/**
 * Decide what moving `company` into `target` means. Pure.
 *
 * The refusals are the interesting part: you cannot un-send an email, you cannot
 * hand-write a status the log contradicts, and you cannot receive a reply to an
 * email that was never sent.
 */
export function planMove(company: Company, target: PipelineColumnId): BoardMove {
  const from = company.status;
  if (from === target) return { kind: "noop" };

  const awaitingInitial = company.schedule_status === "AWAITING_INITIAL";

  switch (target) {
    case "NOT_CONTACTED":
      // Derived purely from "no status-bearing event exists". Nothing un-sends an email.
      return {
        kind: "refused",
        reason: "Not contacted is derived from the log — an email already went out, and nothing un-sends it.",
      };

    case "CONTACTED":
      // Never contacted: the honest move is to log the initial email, which sets
      // the immutable cadence anchor (rule 3) rather than flipping a column.
      if (from === "NOT_CONTACTED") {
        return {
          kind: "event",
          eventType: "INITIAL_EMAIL",
          consequence: "Logging the initial email starts the cadence and fixes its anchor date for good.",
        };
      }
      // A logged reply or bounce says otherwise, and the log wins.
      if (EVENT_DERIVED.includes(from)) {
        return {
          kind: "refused",
          reason:
            from === "RESPONDED"
              ? "A reply is on the log. To chase again, restart the cadence from the company's dossier."
              : "A bounce is on the log. Fix the address on the contact, then restart the cadence.",
        };
      }
      // Clearing a manual flag back to what the log actually says.
      return {
        kind: "status",
        status: "CONTACTED",
        confirm: null,
        undoable: true,
      };

    case "RESPONDED":
      if (awaitingInitial || from === "NOT_CONTACTED") {
        return {
          kind: "refused",
          reason: "No initial email has been logged yet — there is nothing for them to have replied to.",
        };
      }
      return {
        kind: "event",
        eventType: "RESPONSE",
        consequence: "Logging a reply stops the cadence — no further follow-ups will come due.",
      };

    case "BOUNCED":
      if (awaitingInitial || from === "NOT_CONTACTED") {
        return {
          kind: "refused",
          reason: "No initial email has been logged yet, so nothing can have bounced.",
        };
      }
      return {
        kind: "event",
        eventType: "BOUNCE",
        consequence: "Logging a bounce stops the cadence and marks the address undeliverable.",
      };

    case "INTERESTED":
      // A hand flag that reads the room; it does not stop the clock (rule 4).
      return {
        kind: "status",
        status: "INTERESTED",
        confirm: null,
        undoable: true,
      };

    case "DECLINED":
      return {
        kind: "status",
        status: "DECLINED",
        confirm: {
          title: `Mark ${company.company_name} declined?`,
          description:
            "This stops the cadence — no further follow-ups come due. Nothing is deleted, and you can move the card back.",
          confirmText: "Mark declined",
        },
        undoable: true,
      };
  }
}

/** Column a company belongs in. Every status maps to exactly one column. */
export function columnOf(company: Company): PipelineColumnId {
  return company.status as PipelineColumnId;
}

/**
 * Which columns this card could legally be dropped into — used to dim the ones it
 * can't reach while dragging, so a refusal is visible before the drop rather than
 * after it.
 */
export function legalTargets(company: Company): Set<PipelineColumnId> {
  const out = new Set<PipelineColumnId>();
  for (const id of COLUMN_IDS) {
    const move = planMove(company, id);
    if (move.kind !== "refused" && move.kind !== "noop") out.add(id);
  }
  return out;
}

/** Group companies into board columns, preserving the incoming (attention) order. */
export function buildBoard<T extends Company>(companies: T[]): Record<PipelineColumnId, T[]> {
  const out = Object.fromEntries(COLUMN_IDS.map((id) => [id, [] as T[]])) as Record<
    PipelineColumnId,
    T[]
  >;
  for (const c of companies) {
    const col = columnOf(c);
    // Defensive: an unknown status would otherwise vanish from the board.
    if (out[col]) out[col].push(c);
  }
  return out;
}

/**
 * Move a card between cached columns so a status drop lands instantly. Pure, and
 * used for the optimistic update *and* its rollback.
 */
export function applyStatusMove<T extends Company>(
  board: Record<PipelineColumnId, T[]>,
  companyId: number,
  target: PipelineColumnId,
): Record<PipelineColumnId, T[]> {
  let moving: T | undefined;
  for (const id of COLUMN_IDS) {
    const found = board[id].find((c) => c.id === companyId);
    if (found) {
      moving = found;
      break;
    }
  }
  if (!moving || columnOf(moving) === target) return board;
  const moved = { ...moving, status: target } as T;
  return Object.fromEntries(
    COLUMN_IDS.map((id) => {
      if (id === target) return [id, [moved, ...board[id].filter((c) => c.id !== companyId)]];
      return [id, board[id].filter((c) => c.id !== companyId)];
    }),
  ) as Record<PipelineColumnId, T[]>;
}

/** True when the column's own cadence language should be shown on its cards. */
export function columnRunsCadence(id: PipelineColumnId): boolean {
  return id === "CONTACTED" || id === "INTERESTED";
}

export { MANUAL as MANUAL_STATUSES, EVENT_DERIVED as EVENT_DERIVED_STATUSES };
