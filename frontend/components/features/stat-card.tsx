"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCounter } from "@/hooks/use-counter";

interface StatCardProps {
  label: string;
  value: number | string | null;
  icon?: LucideIcon;
  hint?: string;
  isLoading?: boolean;
  isPercent?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Week-over-week change shown as a coloured arrow next to the value. */
  delta?: number | null;
  /** Whether an increase is "good" (green). Default true; set false for e.g. overdue. */
  deltaGoodUp?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  isLoading,
  isPercent,
  className,
  style,
  delta,
  deltaGoodUp = true,
}: StatCardProps) {
  const numericTarget = typeof value === "number" ? value : null;
  const counted = useCounter(numericTarget);

  const displayValue =
    value === null
      ? "—"
      : typeof value === "number"
      ? isPercent
        ? `${counted ?? value}%`
        : (counted ?? value)
      : value;

  return (
    <Card className={cn("stat-card gap-0 py-0", className)} style={style}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
        </div>
        {isLoading ? (
          <Skeleton className="mt-2 h-9 w-20" />
        ) : (
          <div className="mt-2 flex items-baseline gap-2">
            <div
              className="text-3xl font-semibold tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {displayValue}
            </div>
            {delta != null && delta !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  delta > 0 === deltaGoodUp
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive-ink",
                )}
              >
                {delta > 0 ? "↑" : "↓"}
                {Math.abs(delta)}
              </span>
            )}
          </div>
        )}
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
