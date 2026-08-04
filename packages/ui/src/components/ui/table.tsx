"use client";

import { cn } from "@customreport/ui/lib/utils";
import type * as React from "react";

/**
 * Scroll-wrapped HTML table with base cell styles.
 */
function Table({
  className,
  ...props
}: Readonly<React.ComponentProps<"table">>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-hidden rounded-lg border border-border"
    >
      <div className="overflow-x-auto">
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  );
}

/**
 * Table head section (`thead`).
 */
function TableHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<"thead">>) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b border-b-border", className)}
      {...props}
    />
  );
}

/**
 * Table body section (`tbody`).
 */
function TableBody({
  className,
  ...props
}: Readonly<React.ComponentProps<"tbody">>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/**
 * Table footer section (`tfoot`).
 */
function TableFooter({
  className,
  ...props
}: Readonly<React.ComponentProps<"tfoot">>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-t-border bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Table row with hover/selected styles.
 */
function TableRow({
  className,
  ...props
}: Readonly<React.ComponentProps<"tr">>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-b-border transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header cell (`th`).
 */
function TableHead({
  className,
  ...props
}: Readonly<React.ComponentProps<"th">>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-4 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground uppercase tracking-wider [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Body cell (`td`).
 */
function TableCell({
  className,
  ...props
}: Readonly<React.ComponentProps<"td">>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-2.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Caption element for the table.
 */
function TableCaption({
  className,
  ...props
}: Readonly<React.ComponentProps<"caption">>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
