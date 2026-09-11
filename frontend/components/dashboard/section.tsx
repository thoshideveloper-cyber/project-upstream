"use client";

import { PANEL } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * A titled panel: a sentence-case heading on a hairline, an optional count and action,
 * and a body that can run edge-to-edge (for lists and tables) or take the default
 * padding. The icon, when given, is always muted — a heading is not a state.
 */
export function Section({
  title,
  icon,
  badge,
  action,
  children,
  className,
  bodyClassName,
  flush,
  style,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <section className={cn(PANEL, "flex min-w-0 flex-col overflow-hidden", className)} style={style}>
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {icon && (
            <span className="flex shrink-0 [&_svg]:size-4 [&_svg]:text-muted-foreground" aria-hidden>
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
          {badge && <span className="shrink-0 font-normal">{badge}</span>}
        </h2>
        {action && <div className="shrink-0 text-xs">{action}</div>}
      </header>
      <div className={cn("min-w-0", flush ? "" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
