import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * An empty state teaches the next step: what this place holds, why it is empty, and the
 * one action that fills it. A bordered well rather than a dashed dropzone — nothing is
 * being dropped here.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg bg-subtle px-6 py-12 text-center ring-1 ring-border",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 grid size-9 place-items-center rounded-lg bg-card ring-1 ring-border">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
