"use client";

import type { PeriodListItem, PeriodState } from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
  joinPeriodLabel,
} from "../../../lib/format-date";
import { ActionIconRow } from "./periods-action-icon-row";

export interface PeriodTableProps {
  readonly rows: readonly PeriodListItem[];
  readonly testIdPrefix: "active" | "archive";
  readonly onPublish: (row: PeriodListItem) => void;
  readonly onReopen: (row: PeriodListItem) => void;
  readonly onArchive: (row: PeriodListItem) => void;
  readonly onUnarchive: (row: PeriodListItem) => void;
  readonly onDelete: (row: PeriodListItem) => void;
  readonly onEdit: (row: PeriodListItem) => void;
}

const PERIOD_COLUMN_HEADINGS = [
  "Period",
  "State",
  "Progress",
  "Deadline",
] as const;

function PeriodTableHeaderRow() {
  return (
    <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
      {PERIOD_COLUMN_HEADINGS.map((heading) => (
        <th
          key={heading}
          className="px-4 py-3 font-semibold text-[var(--color-foreground)]"
        >
          {heading}
        </th>
      ))}
      <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
        Actions
      </th>
    </tr>
  );
}

/**
 * Period Table.
 * @param props - The props argument.
 */
export function PeriodTable({
  rows,
  testIdPrefix,
  ...actions
}: PeriodTableProps) {
  return (
    <div
      className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid={`periods-${testIdPrefix}-table`}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <PeriodTableHeaderRow />
        </thead>
        <tbody>
          {rows.map((row) => (
            <PeriodRow
              key={row.id}
              row={row}
              testIdPrefix={testIdPrefix}
              {...actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// State pill plus the "reopened" marker — the only cell with two signals.
function PeriodStateCell({ row }: { readonly row: PeriodListItem }) {
  return (
    <td className="px-4 py-3">
      <StateBadge state={row.periodState} />
      {row.periodStatus === "reopened" && (
        <span
          className="ml-2 inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{
            backgroundColor: CHIP_TONE.amber.bg,
            color: CHIP_TONE.amber.text,
          }}
          data-testid={`periods-row-${row.id}-reopened-badge`}
        >
          reopened
        </span>
      )}
    </td>
  );
}

function PeriodRow({
  row,
  testIdPrefix,
  ...actions
}: {
  readonly row: PeriodListItem;
  readonly testIdPrefix: "active" | "archive";
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  const periodLabel = joinPeriodLabel(
    row.weekLabel ?? formatWeekLabel(row.periodStart),
    formatPeriodRangeWithYear(row.periodStart, row.periodEnd),
  );

  return (
    <tr
      data-testid={`periods-${testIdPrefix}-row-${row.id}`}
      data-period-state={row.periodState}
      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
    >
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        {periodLabel}
      </td>
      <PeriodStateCell row={row} />
      <td className="px-4 py-3">
        <ProgressBadge
          submitted={row.submittedCount}
          total={row.totalCount}
          rowId={row.id}
        />
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {row.deadline === null ? "No deadline" : formatDate(row.deadline)}
      </td>
      <td className="px-4 py-3 text-right">
        <ActionIconRow row={row} {...actions} />
      </td>
    </tr>
  );
}

// Admin-table chip tones for the states the design tokens do not cover yet
// (only success/primary have tokens). Background + foreground are paired so a
// tone is picked as one unit and contrast never drifts.
const CHIP_TONE = {
  neutral: { bg: "#e5e7eb", text: "#374151" },
  brand: { bg: "var(--color-success)", text: "var(--color-primary)" },
  violet: { bg: "#e8e0f0", text: "#6b21a8" },
  muted: { bg: "#f3f4f6", text: "#6b7280" },
  amber: { bg: "#fef3c7", text: "#92400e" },
  red: { bg: "#fee2e2", text: "#991b1b" },
} as const;

const STATE_BADGE_STYLES: Record<
  PeriodState,
  { bg: string; text: string; label: string }
> = {
  scheduled: { ...CHIP_TONE.neutral, label: "scheduled" },
  open: { ...CHIP_TONE.brand, label: "open" },
  published: { ...CHIP_TONE.violet, label: "published" },
  archived: { ...CHIP_TONE.muted, label: "archived" },
};

function StateBadge({ state }: { readonly state: PeriodState }) {
  const s = STATE_BADGE_STYLES[state];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
      data-testid={`state-badge-${state}`}
    >
      {s.label}
    </span>
  );
}

const PROGRESS_AMBER_THRESHOLD = 0.5;

const PROGRESS_TONE_STYLES = {
  success: CHIP_TONE.brand,
  amber: CHIP_TONE.amber,
  red: CHIP_TONE.red,
} as const;

// submitted/total with a 3-tier color scale for quick scan of lagging periods.
function ProgressBadge({
  submitted,
  total,
  rowId,
}: {
  readonly submitted: number;
  readonly total: number;
  readonly rowId: string;
}) {
  // Edge case: total === 0 happens for newly minted periods before the
  // auto-creator provisioned the per-lead sections. Show `—` so the row
  // doesn't claim "0/0 complete" — that would imply 100% and mislead.
  if (total === 0) {
    return (
      <span
        className="text-xs text-[var(--color-muted-foreground)]"
        data-testid={`periods-row-${rowId}-progress`}
      >
        —
      </span>
    );
  }
  const ratio = submitted / total;
  const tone =
    ratio >= 1
      ? "success"
      : ratio >= PROGRESS_AMBER_THRESHOLD
        ? "amber"
        : "red";
  const c = PROGRESS_TONE_STYLES[tone];
  const pending = total - submitted;
  const tooltipText =
    pending > 0
      ? `${submitted} of ${total} leads submitted — ${pending} pending`
      : `All ${total} leads submitted`;
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`periods-row-${rowId}-progress`}
      data-progress-tone={tone}
      title={tooltipText}
    >
      {submitted}/{total}
    </span>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
