import type { LeadInfo } from "../../lib/mappers/dashboard";
import { RemindLeadButton } from "./remind-lead-button";
import { RevokeSectionButton } from "./revoke-lead-button";

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Returns true when `lastActivity` is an ISO-date string whose parsed time is
 * more than 24 hours ago, or when it is the "Not started" sentinel meaning no
 * section or content has been created yet.
 *
 * "In progress" means the lead has an open draft (section exists, contentCount
 * > 0, no submittedAt). That lead is actively working — treat as active.
 *
 * Date-only strings ("2026-05-21") are parsed as local midnight to avoid the
 * Date.parse UTC-midnight pitfall, which mis-flagged active leads as inactive
 * in eastern timezones during the early morning local time.
 */
function isInactive24h(lastActivity: string): boolean {
  // "Not started" → no section exists yet; definitively idle.
  if (lastActivity === "Not started") return true;
  // "In progress" → lead has an open draft (dashboard.ts:281-282 sets this
  // sentinel when status !== "pending" and submittedAt is null). Treat as
  // active regardless of timestamp absence.
  if (lastActivity === "In progress") return false;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(lastActivity);
  const parsed = Date.parse(
    isDateOnly ? `${lastActivity}T00:00:00` : lastActivity,
  );
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed > MS_24H;
}

const STATUS_LABELS: Record<LeadInfo["status"], string> = {
  submitted: "Submitted",
  draft: "In progress",
  pending: "Not started",
};

const STATUS_CLASSES: Record<LeadInfo["status"], string> = {
  submitted:
    "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]",
  draft: "border-[#d4a017] bg-[#fef3c7] text-[#8a6d1b]",
  pending:
    "border-[rgba(0,0,0,0.16)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

// head-surface-uat-polish (F5): per-lead counts render as compact labeled stat
// cells (the History Summary idiom) instead of ten ruled table columns.
const COUNT_FIELDS: readonly {
  readonly label: string;
  readonly get: (lead: LeadInfo) => number;
}[] = [
  { label: "Products", get: (l) => l.productCount ?? 0 },
  { label: "Current", get: (l) => l.currentItemCount ?? 0 },
  { label: "Next", get: (l) => l.nextItemCount ?? 0 },
  { label: "Risks", get: (l) => l.riskCount ?? 0 },
  { label: "Decisions", get: (l) => l.decisionCount ?? 0 },
  { label: "Priorities", get: (l) => l.priorityCount ?? 0 },
];

interface LeadSummaryTableProps {
  readonly leads: readonly LeadInfo[];
  readonly reportId?: string;
  /**
   * D6 (head-dashboard-declutter): same `canSendReminder` gate the AlertBar
   * honors (`periodStatus !== "published" && hasActiveReminderRule`). When
   * false, the per-lead Remind button is not offered — without an active
   * reminder rule a dispatch returns `no-active-rule`, so the action would be
   * dead. Defaults to false so a caller that omits it never shows a dead Remind.
   */
  readonly canSendReminder?: boolean;
}

function LeadActionCell({
  lead,
  reportId,
  canSendReminder,
}: {
  readonly lead: LeadInfo;
  readonly reportId?: string;
  readonly canSendReminder: boolean;
}) {
  if (canSendReminder && reportId && lead.status === "draft") {
    return (
      <RemindLeadButton
        reportId={reportId}
        leadId={lead.id}
        leadName={lead.name}
      />
    );
  }
  if (lead.status === "submitted" && lead.reportSectionId) {
    return (
      <RevokeSectionButton
        reportSectionId={lead.reportSectionId}
        leadName={lead.name}
      />
    );
  }
  return (
    <span
      className="text-xs text-[var(--color-muted-foreground)]"
      aria-hidden="true"
    >
      —
    </span>
  );
}

export function LeadSummaryTable({
  leads,
  reportId,
  canSendReminder = false,
}: LeadSummaryTableProps) {
  if (leads.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-5"
        aria-labelledby="lead-summary-heading"
      >
        <h2
          id="lead-summary-heading"
          className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
        >
          Period Summary
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          No lead rows for the current period.
        </p>
      </section>
    );
  }

  // head-surface-uat-polish (F5): the Period Summary keeps the
  // BlockedAtRiskTable card idiom — a rounded, soft-shadowed container with
  // gap-separated per-lead cards. UAT follow-up: the per-lead counts now sit on
  // shared subgrid column rails (the `<ul>` defines the tracks; each `<li>` and
  // its counts `<dl>` are `grid-cols-subgrid` participants) so every column
  // lines up across rows at any value — the earlier flex/`ml-auto` layout only
  // aligned by accident and drifted on uneven content. The full count labels
  // and warm cards are retained intentionally (see design note in the spec).
  return (
    <section
      className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]"
      aria-labelledby="lead-summary-heading"
    >
      <div className="border-b border-[rgba(0,0,0,0.08)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="lead-summary-heading"
            className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
          >
            Period Summary
          </h2>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
            {leads.length} leads
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Submitted sections and content counts by lead.
        </p>
      </div>

      {/* responsive-compact-layout: below `md` the subgrid rails give way to
          stacked cards whose counts wrap as a labeled-value list, so the
          summary keeps its no-horizontal-scroll guarantee at phone width. */}
      <ul className="grid gap-y-2 p-3 md:grid-cols-[minmax(10rem,1fr)_auto_repeat(6,4.5rem)_auto_auto] md:gap-x-4 md:p-4">
        {leads.map((lead) => {
          // A submitted lead is done, not "gone quiet" — the 24h-inactive
          // nudge styling only makes sense for leads with open work
          // (draft/pending). Exempt submitted rows so a Monday submission
          // does not read as stale (its date-only `lastActivity` would
          // otherwise parse to local midnight and trip the >24h gate on
          // every day but the period's first).
          const inactive =
            lead.status !== "submitted" && isInactive24h(lead.lastActivity);
          return (
            <li
              key={lead.id}
              data-testid={
                inactive ? "lead-row-inactive-24h" : "lead-summary-row"
              }
              className={`flex flex-col gap-2 rounded-lg border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.02)] p-3 md:col-span-full md:grid md:grid-cols-subgrid md:items-center${
                inactive ? " opacity-60" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-bold text-[var(--color-primary)]">
                  {lead.initials}
                </span>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--color-foreground)]">
                    {lead.name}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                    {lead.role}
                  </span>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center justify-self-start whitespace-nowrap rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold ${
                  STATUS_CLASSES[lead.status]
                }`}
              >
                {STATUS_LABELS[lead.status]}
              </span>

              <dl className="flex flex-wrap gap-x-4 gap-y-1.5 md:col-span-6 md:grid md:grid-cols-subgrid md:items-center">
                {COUNT_FIELDS.map((field) => (
                  <div
                    key={field.label}
                    // flex-col-reverse keeps the value visually on top while the
                    // DOM stays <dt> before <dd> (correct term→definition order
                    // for assistive tech).
                    className="flex flex-col-reverse items-center"
                  >
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {field.label}
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-[var(--color-foreground)]">
                      {field.get(lead)}
                    </dd>
                  </div>
                ))}
              </dl>

              <span className="text-xs text-[var(--color-muted-foreground)] md:justify-self-end md:text-right">
                <span className="sr-only">Submitted: </span>
                {lead.submittedAtLabel ?? "-"}
              </span>

              <div className="flex justify-end">
                <LeadActionCell
                  lead={lead}
                  reportId={reportId}
                  canSendReminder={canSendReminder}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
