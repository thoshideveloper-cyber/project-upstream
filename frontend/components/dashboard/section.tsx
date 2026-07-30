"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Standard dashboard panel: uppercase eyebrow header + optional action, with
 *  a body that can run edge-to-edge (for lists) or use the default padding. */
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
    <Card className={cn("stat-card gap-0 py-0", className)} style={style}>
      <CardHeader className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {icon}
            {title}
            {badge}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn(flush ? "p-0" : "p-4", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}
