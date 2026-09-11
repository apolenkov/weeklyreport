"use client";

import Link from "next/link";

// In-app breadcrumb for a report surface. The current crumb carries the report's
// identifying period metadata, mirroring `<title>` (report-routing spec).
export function ReportBreadcrumb({
  label,
  reportsHref = "/reports",
}: {
  readonly label: string;
  readonly reportsHref?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
        <li className="shrink-0">
          <Link href={reportsHref} className="hover:underline">
            Reports
          </Link>
        </li>
        <li aria-hidden="true" className="shrink-0">
          /
        </li>
        <li
          aria-current="page"
          className="truncate font-medium text-[var(--color-foreground)]"
        >
          {label}
        </li>
      </ol>
    </nav>
  );
}
