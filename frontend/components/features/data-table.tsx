"use client";

import { AlertCircle } from "lucide-react";

import { EmptyState } from "@/components/features/empty-state";
import { TableSkeleton } from "@/components/features/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  getRowId: (row: T) => string | number;
  isLoading?: boolean;
  error?: { message: string } | null;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  error,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return <TableSkeleton cols={columns.length} />;
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load this list"
        description={error.message}
      />
    );
  }

  if (!data || data.length === 0) {
    return <>{emptyState ?? <EmptyState title="Nothing here yet" />}</>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card border-b border-border">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                  col.className,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "data-row border-b border-border transition-colors hover:bg-primary/[0.04]",
                onRowClick && "cursor-pointer",
              )}
              style={{ "--row-i": index } as React.CSSProperties}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
