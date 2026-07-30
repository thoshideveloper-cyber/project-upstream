"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const MONO = { fontFamily: "var(--font-mono)" };

/**
 * Floating selection action bar for the P2 DataTable pattern. Appears (bottom-centre)
 * only when a selection exists; hosts a live count, a clear control, and whatever
 * bulk actions the table passes as children. Motion is a short slide-up that
 * `prefers-reduced-motion` neutralises via the shared `animate-in` utilities.
 *
 * `role="toolbar"` + a labelled region so the count is announced and the actions are
 * reachable by keyboard as a group.
 */
export function BulkBar({
  count,
  noun = "selected",
  onClear,
  children,
  className,
}: {
  count: number;
  /** Rendered after the number, e.g. "companies". */
  noun?: string;
  onClear: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label={`${count} ${noun}`}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
    >
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className={cn(
          "pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg ring-1 ring-border backdrop-blur duration-200 animate-in fade-in-0 slide-in-from-bottom-2 supports-[backdrop-filter]:bg-card/85",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 pl-1 pr-1 text-sm">
          <span className="font-semibold tabular-nums text-foreground" style={MONO}>
            {count}
          </span>
          <span className="text-muted-foreground">{noun}</span>
        </span>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        {children}
        <button
          onClick={onClear}
          className="ml-0.5 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      </div>
    </div>
  );
}
