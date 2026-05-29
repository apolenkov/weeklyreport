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

type LeadSummaryTableProps = {
  readonly leads: readonly LeadInfo[];
  readonly reportId?: string;
};

export function LeadSummaryTable({ leads, reportId }: LeadSummaryTableProps) {
  if (leads.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5"
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

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      aria-labelledby="lead-summary-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h2
            id="lead-summary-heading"
            className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
          >
            Period Summary
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Submitted sections and content counts by lead.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
              <th scope="col" className="px-5 py-3">
                Lead
              </th>
              <th scope="col" className="px-5 py-3">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Products
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Current
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Next
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Risks
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Decisions
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Priorities
              </th>
              <th scope="col" className="px-5 py-3">
                Submitted
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const inactive = isInactive24h(lead.lastActivity);
              return (
                <tr
                  key={lead.id}
                  className={
                    "border-b border-[var(--color-border)] last:border-0" +
                    (inactive ? " bg-muted/30 opacity-60" : "")
                  }
                  data-testid={inactive ? "lead-row-inactive-24h" : undefined}
                >
                  <th scope="row" className="px-5 py-3 text-left">
                    <div className="flex items-center gap-3">
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
                  </th>
                  <td className="px-5 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold " +
                        STATUS_CLASSES[lead.status]
                      }
                    >
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.productCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.currentItemCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.nextItemCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.riskCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.decisionCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--color-foreground)]">
                    {lead.priorityCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted-foreground)]">
                    {lead.submittedAtLabel ?? "-"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {reportId && lead.status === "draft" ? (
                      <RemindLeadButton
                        reportId={reportId}
                        leadId={lead.id}
                        leadName={lead.name}
                      />
                    ) : lead.status === "submitted" && lead.reportSectionId ? (
                      <RevokeSectionButton
                        reportSectionId={lead.reportSectionId}
                        leadName={lead.name}
                      />
                    ) : (
                      <span
                        className="text-xs text-[var(--color-muted-foreground)]"
                        aria-hidden="true"
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
