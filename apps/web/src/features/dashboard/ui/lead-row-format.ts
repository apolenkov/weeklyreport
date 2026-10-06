import { formatRelativePast } from "../../../shared/lib/format/format-date";
import type { LeadInfo } from "../model/dashboard";

// The loading skeleton renders rows on this same grid so the loading state
// reserves the loaded queue's track geometry (dashboard-interaction-stability).
// Below lg the row is a two-column card (identity | state) followed by one meta
// line and one action line; at lg the meta and action wrappers dissolve into the
// six desktop tracks.
export const QUEUE_ROW_GRID_CLASS =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 sm:p-4 lg:grid-cols-[minmax(11rem,1.3fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_var(--dashboard-summary-action-w)_var(--dashboard-summary-action-w)] lg:gap-3";

export const QUEUE_META_CLASS =
  "flex min-w-0 flex-wrap items-baseline gap-x-2 max-lg:col-span-2 lg:contents";

export const QUEUE_ACTIONS_CLASS = "flex gap-2 max-lg:col-span-2 lg:contents";

// Each action fills half the line on a phone and keeps its desktop track from sm.
export const QUEUE_ACTION_CELL_CLASS =
  "max-sm:w-auto max-sm:flex-1 w-[var(--dashboard-summary-action-w)]";

export const STATUS_LABELS: Readonly<Record<LeadInfo["status"], string>> = {
  submitted: "Submitted",
  draft: "In progress",
  pending: "Not started",
};

export const STATUS_CLASSES: Readonly<Record<LeadInfo["status"], string>> = {
  submitted:
    "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]",
  draft:
    "border-[var(--color-status-dot-at-risk)] bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
  pending:
    "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

export function freshnessLabel(lead: LeadInfo): string {
  if (lead.status === "submitted") {
    return lead.submittedAt
      ? `Submitted ${formatRelativePast(lead.submittedAt, new Date(), "activity")}`
      : "Submitted";
  }
  if (lead.lastEditAt) {
    return `Edited ${formatRelativePast(lead.lastEditAt, new Date(), "activity")}`;
  }
  return lead.isStale ? "No recent edit" : "No edits yet";
}

export function contentSummary(lead: LeadInfo): string {
  const productRecords = lead.reportContentCount ?? 0;
  const activityRecords = lead.activityCount ?? 0;
  const total = productRecords + activityRecords;
  return `${total} record${total === 1 ? "" : "s"} · ${lead.attentionLabel}`;
}
