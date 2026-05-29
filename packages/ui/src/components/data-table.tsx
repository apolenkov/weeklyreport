"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@customreport/ui/components/ui/table";
import { cn } from "@customreport/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => React.ReactNode;
  className?: string;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  "aria-label"?: string;
};

function sortData<T>(data: readonly T[], sort: SortState): T[] {
  if (!sort) {
    return [...data];
  }

  const { key, direction } = sort;

  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[key];
    const bVal = (b as Record<string, unknown>)[key];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return direction === "asc" ? -1 : 1;
    if (bVal == null) return direction === "asc" ? 1 : -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return direction === "asc" ? cmp : -cmp;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    const cmp = String(aVal).localeCompare(String(bVal));
    return direction === "asc" ? cmp : -cmp;
  });
}

function cycleSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { key, direction: "desc" };
  }
  return null;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState>(null);

  const sortedData = React.useMemo(() => sortData(data, sort), [data, sort]);

  return (
    <Table aria-label={ariaLabel}>
      <TableHeader className="bg-muted">
        <TableRow className="hover:bg-muted">
          {columns.map((column) => {
            const isActive = sort?.key === column.key;
            const ariaSortValue = isActive
              ? sort.direction === "asc"
                ? "ascending"
                : "descending"
              : undefined;

            return (
              <TableHead
                key={column.key}
                className={cn(
                  column.sortable && "cursor-pointer select-none",
                  isActive && "font-semibold",
                  column.className,
                )}
                tabIndex={column.sortable ? 0 : undefined}
                role={column.sortable ? "columnheader" : undefined}
                aria-sort={
                  column.sortable ? (ariaSortValue ?? "none") : undefined
                }
                onClick={
                  column.sortable
                    ? () => setSort((prev) => cycleSort(prev, column.key))
                    : undefined
                }
                onKeyDown={
                  column.sortable
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSort((prev) => cycleSort(prev, column.key));
                        }
                      }
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {column.header}
                  {column.sortable &&
                    isActive &&
                    (sort.direction === "asc" ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    ))}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="text-center py-12">
              <div className="flex flex-col items-center gap-2">
                <p className="text-lg font-semibold text-muted-foreground">
                  No data yet
                </p>
                <p className="text-sm text-muted-foreground">
                  There are no entries to display. They will appear here once
                  data is available.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((row, index) => (
            <TableRow
              key={index}
              className={cn(
                "border-b border-border hover:bg-muted/50",
                onRowClick && "cursor-pointer",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.cell
                    ? column.cell(row)
                    : String(
                        (row as Record<string, unknown>)[column.key] ?? "",
                      )}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
