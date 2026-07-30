import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate every read model that a company / outreach-event / schedule write can
 * affect. A single company add or a logged email changes not just the company list
 * but the mandate rollups, project headline counts, the schedule work queues, and
 * every analytics surface — those live under different query keys, so a mutation that
 * only busts `["companies"]` leaves the project/dashboard/analytics views stale
 * (the "I added a company but it didn't show up in the project" bug).
 *
 * Prefix-matching means `["analytics"]` also busts `["analytics","overview"]`, etc.
 */
export function invalidateOutreachData(qc: QueryClient): void {
  for (const key of [
    ["companies"],
    ["company"],
    // A logged touch also rewrites contact read models (last_contact_date and the
    // sentiment cache) — without these keys the Contacts page shows stale reads.
    ["contacts"],
    ["contact"],
    ["my-book"],
    ["company-profiles"],
    ["schedule"],
    ["mandates"],
    ["mandate"],
    ["projects"],
    ["project"],
    ["analytics"],
    ["benchmark"],
  ]) {
    qc.invalidateQueries({ queryKey: key });
  }
}
