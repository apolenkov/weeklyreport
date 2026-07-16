"use client";

import type {
  ActivityLiveResponse,
  ActivityLiveRow,
} from "@customreport/shared";
import { initialsFromName as sharedInitialsFromName } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";

import { formatRelativePast } from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * "Submission Activity" panel.
 *
 * Renders one row per lead's section in the open report period with a
 * status pill (Draft / Submitted), counts (items / risks /
 * decisions / priorities), and a relative-time of last edit. Polls
 * activity.live every 15 seconds.
 *
 * Rows with content link to /head/report/<reportId>?authorId=<leadId>.
 * Empty rows stay muted and non-clickable so the dashboard does not send
 * heads into an empty focused report.
 *
 * If the period is closed/published the panel renders a published-period
 * empty state instead of a row grid.
 */
const POLL_INTERVAL_MS = 15_000;

export function ActivityLivePanel() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.activity.live.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      aria-labelledby="activity-live-heading"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="activity-live-heading"
          className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
        >
          Submission Activity
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Shows every lead section; rows with content open the detailed report.
        </span>
      </header>
      {renderBody(query.data, query.isLoading, query.isError, query.error)}
    </section>
  );
}

function renderBody(
  data: ActivityLiveResponse | undefined,
  isLoading: boolean,
  isError: boolean,
  error: unknown,
) {
  if (isLoading && !data) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Loading activity…
      </p>
    );
  }

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Failed to load activity";
    return <p className="text-sm text-[var(--color-danger)]">{message}</p>;
  }

  if (!data?.reportId) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No open reporting period.
      </p>
    );
  }

  if (data.periodStatus !== "open" && data.periodStatus !== "reopened") {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Period is closed; activity is not tracked.
      </p>
    );
  }

  // We already returned early when reportId was null; capture into a
  // const so the closure below sees a non-nullable string without a `!`.
  const reportId = data.reportId;

  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Leads have not started their reports yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1" aria-label="Lead section statuses">
      {data.rows.map((row) => (
        <ActivityRow key={row.leadId} row={row} reportId={reportId} />
      ))}
    </ul>
  );
}

function ActivityRow({
  row,
  reportId,
}: {
  readonly row: ActivityLiveRow;
  readonly reportId: string;
}) {
  // Links always use the addressed URL form `/head/report/<reportId>` so
  // they're shareable / bookmarkable.
  const href = `/head/report/${encodeURIComponent(reportId)}?authorId=${encodeURIComponent(row.leadId)}`;
  const contentCount =
    row.itemCount + row.riskCount + row.decisionCount + row.priorityCount;
  const hasContent = contentCount > 0;
  const lastEdit = row.lastEditAt
    ? formatRelativePast(new Date(row.lastEditAt), new Date(), "activity")
    : "not started";
  const rowClassName =
    "flex flex-wrap items-center gap-3 rounded-[var(--radius)] border px-2 py-3 transition-[background-color,border-color,box-shadow]";
  const interactiveClassName = `${
    rowClassName
  } cursor-pointer border-transparent hover:border-[rgba(0,117,74,0.14)] hover:bg-[var(--color-success)] hover:shadow-[inset_3px_0_0_var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2`;
  const emptyClassName = `${
    rowClassName
  } cursor-default border-transparent bg-[rgba(0,0,0,0.025)] opacity-65`;

  const content = (
    <>
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-[12px] font-semibold text-[var(--color-starbucks-accent)]"
        aria-hidden="true"
      >
        {initials(row.leadName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
            {row.leadName}
          </span>
          <StatusPill status={row.status} hasContent={hasContent} />
        </div>
        <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {row.itemCount} items · {row.riskCount} risks · {row.decisionCount}{" "}
          decisions · {row.priorityCount} priorities
        </div>
      </div>
      <div className="text-right text-xs text-[var(--color-muted-foreground)]">
        {lastEdit}
      </div>
    </>
  );

  return (
    <li>
      {hasContent ? (
        <a
          href={href}
          className={interactiveClassName}
          aria-label={`Open ${row.leadName} report section`}
          title={`Open ${row.leadName} report section`}
        >
          {content}
        </a>
      ) : (
        <div
          className={emptyClassName}
          title={`${row.leadName} has no report content yet`}
        >
          {content}
        </div>
      )}
    </li>
  );
}

function StatusPill({
  status,
  hasContent,
}: {
  readonly status: "draft" | "submitted";
  readonly hasContent: boolean;
}) {
  if (!hasContent) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]">
        No content
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-starbucks-accent)]">
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-status-at-risk-fg)]">
      Draft
    </span>
  );
}

// Avatar initials via the canonical shared helper (surname-first ФИО), with
// this surface's "??" placeholder for an empty name. The token logic lives once
// in @customreport/shared.
function initials(name: string): string {
  return sharedInitialsFromName(name) || "??";
}
