import type { MandateType } from "@/types";

/** Short, human labels for engagement sides. */
export const ENGAGEMENT_TYPE_LABEL: Record<MandateType, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

/** What each side is sourcing for, in the analyst's words. */
export const ENGAGEMENT_SIDE_HINT: Record<MandateType, string> = {
  SELL_SIDE: "finding buyers",
  BUY_SIDE: "finding targets",
  CAPITAL_RAISE: "finding investors",
};

/**
 * The seed (and older data) bakes a redundant client suffix into engagement
 * names — e.g. name "Pharma Consolidation — Medanta" under client
 * "Medanta Healthcare", or a project whose name equals its client. Rendering
 * `client — name` then produces "Medanta Healthcare — Pharma Consolidation —
 * Medanta". This strips the redundant tail so the deal reads cleanly.
 */
export function cleanEngagementName(name: string, clientName: string): string {
  const trimmed = (name ?? "").trim();
  const client = (clientName ?? "").trim();
  if (!trimmed) return client;
  if (trimmed.toLowerCase() === client.toLowerCase()) return client;

  const parts = trimmed.split(/\s+—\s+/);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].trim().toLowerCase();
    const clientLc = client.toLowerCase();
    const clientHead = clientLc.split(/\s+/)[0] ?? "";
    // Drop the tail when it's just the client name echoed back.
    if (tail && (clientLc.includes(tail) || (clientHead.length > 2 && tail.includes(clientHead)))) {
      return parts.slice(0, -1).join(" — ").trim();
    }
  }
  return trimmed;
}

/**
 * A two-part label for anything shaped like `{ client_name, name }`
 * (engagements or projects). `primary` is the deal/engagement, `secondary`
 * is the client. When the two collapse to the same thing we surface the
 * client once and leave `secondary` empty.
 */
export function dealLabel(clientName: string, name: string): { primary: string; secondary: string } {
  const client = (clientName ?? "").trim();
  const engagement = cleanEngagementName(name, client);
  if (!engagement || engagement.toLowerCase() === client.toLowerCase()) {
    return { primary: client || engagement, secondary: "" };
  }
  return { primary: engagement, secondary: client };
}
