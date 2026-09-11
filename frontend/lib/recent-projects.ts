/**
 * Which projects this person actually works in.
 *
 * The sidebar rail used to rank projects by overdue count, which sounds right and is
 * subtly wrong: the project with the most late follow-ups is often a big imported book
 * nobody is actively running, and it pushed the two projects an analyst opens twenty
 * times a day to the bottom of the list. Recency is the better first key — it is a
 * record of what this person is doing, not of what the data happens to look like.
 *
 * Per-browser and per-person by construction, which is what "recent" means. Every access
 * is wrapped: a private window or a browser blocking site data must produce an empty
 * list, never a thrown render.
 */

const KEY = "upstream.recent-projects";
const MAX = 6;

export function recentProjects(): number[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/** Move a project to the front of the list. Returns the new list. */
export function touchProject(id: number): number[] {
  const next = [id, ...recentProjects().filter((n) => n !== id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recency is a convenience, not state anything depends on */
  }
  return next;
}
