import { LockBadge } from "../../shared/ui/report-shell/lock-badge";
import { MetaRow } from "../../shared/ui/report-shell/meta-row";
import { PublishedRecordMarker } from "./item-card-actions";
import { FOREIGN_ENTRY_OPACITY } from "./item-card-style";
import type { DecisionEntry } from "./mock-data";
import { canonicalStageName, splitStageNames } from "./stage-tags";

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  // Render as locale-aware short date so the chip stays compact.
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * One decision card (extracted from decisions-section.tsx): product/deadline
 * chips, own-record edit/delete vs foreign lock badge, decision/impact body,
 * and the unified author+stage meta-row.
 */
export function DecisionCard({
  decision,
  readOnly,
  publishedLocked,
  onEdit,
  onDelete,
}: {
  readonly decision: DecisionEntry;
  readonly readOnly: boolean;
  readonly publishedLocked: boolean;
  readonly onEdit: (decision: DecisionEntry) => void;
  readonly onDelete: (id: string) => void;
}) {
  const stageTags = (
    decision.stageIds && decision.stageIds.length > 0
      ? decision.stageIds
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(decision.stageName)
  )
    // stage-label-canonicalization: heal legacy short "Dev" at render,
    // mirroring the risk row and item card.
    .map(canonicalStageName);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--color-background)",
        opacity: decision.foreign ? FOREIGN_ENTRY_OPACITY : 1,
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
          {decision.productName}
        </span>
        {decision.deadline && (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a6d1b]">
            Due {formatDeadline(decision.deadline)}
          </span>
        )}
        {publishedLocked && <PublishedRecordMarker />}
        {!readOnly && !decision.foreign ? (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
              onClick={() => onEdit(decision)}
              aria-label={`Edit decision`}
            >
              <EditIcon />
            </button>
            {!publishedLocked && (
              <button
                type="button"
                className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                onClick={() => onDelete(decision.id)}
                aria-label={`Delete decision for ${decision.productName}`}
              >
                <DeleteIcon />
              </button>
            )}
          </div>
        ) : decision.foreign === true ? (
          <div className="ml-auto flex gap-1">
            <LockBadge authorName={decision.owner} />
          </div>
        ) : null}
      </div>
      <div className="space-y-2 text-sm text-[var(--color-foreground)]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Decision
          </span>
          <div className="mt-0.5 break-words">
            {decision.text || (
              <em className="text-[var(--color-muted-foreground)]">
                — pending
              </em>
            )}
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Impact
          </span>
          <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
            {decision.impact || "—"}
          </div>
        </div>
      </div>
      {/* Unified [author …… chip] meta-row. A stage-less PRODUCT decision is
          a legacy anomaly, never an implicit "all stages" scope — render the
          loud "No stage set" warning, mirroring risks. An activity-parented
          decision is legitimately stage-less: no chip at all. */}
      <MetaRow
        authorName={decision.owner}
        stageTags={stageTags}
        ariaLabel={`Decision stages: ${
          stageTags.length > 0
            ? stageTags.join(", ")
            : decision.activityId != null
              ? "Activity — no SDLC stage"
              : "No stage set"
        }`}
        foreign={false}
        emptyStageChip={
          decision.activityId != null ? "none" : "no-stage-warning"
        }
      />
    </div>
  );
}
