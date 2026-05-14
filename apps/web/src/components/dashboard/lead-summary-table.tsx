import type { LeadInfo } from "../../lib/mappers/dashboard";

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
};

export function LeadSummaryTable({ leads }: LeadSummaryTableProps) {
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
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-[var(--color-border)] last:border-0"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
