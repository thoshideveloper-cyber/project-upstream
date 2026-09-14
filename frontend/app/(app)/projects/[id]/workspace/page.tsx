"use client";

/**
 * The workspace view — a thin route over `ProjectWorkspace`.
 *
 * The component reads the project from the shell context and its own state from the
 * URL, so this page has nothing to pass down. Kept as a route rather than a mode of the
 * overview because "the book" and "how is the project doing" are different questions
 * with different data, and a shared page would make each pay for the other's fetch.
 */

import { ProjectWorkspace } from "@/components/project/project-workspace";

export default function ProjectWorkspacePage() {
  return <ProjectWorkspace />;
}
