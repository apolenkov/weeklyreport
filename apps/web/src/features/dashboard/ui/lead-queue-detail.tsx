import { formatRelativePast } from "../../../lib/format-date";
import type { LeadInfo } from "../model/dashboard";
import { LeadSecondaryActions } from "./lead-queue-actions";

const COUNT_FIELDS: readonly {
  readonly label: string;
  readonly get: (lead: LeadInfo) => number;
}[] = [
  { label: "Products", get: (lead) => lead.productCount ?? 0 },
  { label: "Current", get: (lead) => lead.currentItemCount ?? 0 },
  { label: "Next", get: (lead) => lead.nextItemCount ?? 0 },
  { label: "Risks", get: (lead) => lead.riskCount ?? 0 },
  { label: "Decisions", get: (lead) => lead.decisionCount ?? 0 },
  { label: "Priorities", get: (lead) => lead.priorityCount ?? 0 },
  { label: "Activities", get: (lead) => lead.activityCount ?? 0 },
];

function relativeTime(value: Date | null, emptyLabel: string): string {
  return value ? formatRelativePast(value, new Date(), "activity") : emptyLabel;
}

export function LeadQueueDetail({
  lead,
  reportId,
  detailId,
  onMutated,
}: {
  readonly lead: LeadInfo;
  readonly reportId: string;
  readonly detailId: string;
  readonly onMutated: () => void;
}) {
  return (
    <div
      id={detailId}
      className="border-t border-[var(--color-border)] px-3 py-4 sm:px-4"
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {COUNT_FIELDS.map((field) => (
          <div
            key={field.label}
            className="rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] p-2"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {field.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-foreground)]">
              {field.get(lead)}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            Last edit
          </dt>
          <dd className="font-medium text-[var(--color-foreground)]">
            {relativeTime(lead.lastEditAt, "No edits yet")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            Submitted
          </dt>
          <dd className="font-medium text-[var(--color-foreground)]">
            {relativeTime(lead.submittedAt, "Not submitted")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            Review
          </dt>
          <dd className="font-medium text-[var(--color-foreground)]">
            {lead.reviewLabel} · {lead.reviews.length} verdict
            {lead.reviews.length === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            Attention
          </dt>
          <dd className="font-medium text-[var(--color-foreground)]">
            {lead.attentionLabel}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <LeadSecondaryActions
          lead={lead}
          reportId={reportId}
          onMutated={onMutated}
        />
      </div>
    </div>
  );
}
