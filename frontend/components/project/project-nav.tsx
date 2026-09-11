"use client";

/**
 * Project-context navigation.
 *
 * Deliberately a different instrument from the global rail: the rail answers "which part
 * of the product am I in", this answers "which question am I asking about this one
 * project". Underlined text tabs on the header's closing hairline, so the whole header
 * block reads as one object you are inside of.
 *
 * These are real routes, not `?view=`: a view you can send someone, that the back
 * button steps through, and that each page can load its own data for.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MONO } from "@/lib/design";
import { cn } from "@/lib/utils";

export interface ProjectTab {
  key: string;
  label: string;
  /** Appended to `/projects/{id}`. Empty string = the overview. */
  segment: string;
  /** A quiet count beside the label. Zero renders nothing. */
  count?: number;
  /** Colours the count — used when the count is a problem. */
  countTone?: "default" | "danger";
}

export function ProjectNav({
  projectId,
  tabs,
  className,
}: {
  projectId: number;
  tabs: ProjectTab[];
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav
      aria-label="Project views"
      className={cn("flex items-center gap-5 overflow-x-auto border-b border-border", className)}
    >
      {tabs.map((t) => {
        const href = t.segment ? `${base}/${t.segment}` : base;
        // Exact match for the overview; prefix match for everything else, so a nested
        // route keeps its parent tab lit.
        const active = t.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;

        return (
          <Link
            key={t.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative -mb-px flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm transition-colors outline-none focus-visible:text-foreground focus-visible:underline",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {t.label}
            {!!t.count && t.count > 0 && (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 text-[11px] font-medium leading-none",
                  t.countTone === "danger"
                    ? "bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger-line"
                    : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
                )}
                style={MONO}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
