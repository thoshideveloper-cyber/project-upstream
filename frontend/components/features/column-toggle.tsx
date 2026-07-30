"use client";

import { Check, Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ToggleableColumn {
  key: string;
  label: string;
  /** Always-on column (e.g. the identity/name column) — shown checked + disabled. */
  locked?: boolean;
}

/**
 * Column show/hide menu for the P2 DataTable pattern. Purely presentational — the
 * visible set + persistence live in `useColumnVisibility`. Locked columns can't be
 * hidden (the table would lose its subject).
 */
export function ColumnToggle({
  columns,
  isVisible,
  onToggle,
  hiddenCount = 0,
}: {
  columns: ToggleableColumn[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string) => void;
  hiddenCount?: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={hiddenCount > 0 ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            aria-label="Choose columns"
          />
        }
      >
        <Columns3 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Columns{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Show columns</div>
        <DropdownMenuSeparator />
        {columns.map((col) => {
          const checked = col.locked || isVisible(col.key);
          return (
            <DropdownMenuItem
              key={col.key}
              disabled={col.locked}
              closeOnClick={false}
              onClick={() => {
                if (!col.locked) onToggle(col.key);
              }}
            >
              <Check className={cn("h-4 w-4", checked ? "opacity-100" : "opacity-0")} aria-hidden />
              {col.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
