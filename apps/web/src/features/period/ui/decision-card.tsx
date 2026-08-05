import { formatTimestampShort } from "../../../shared/lib/format/format-date";
import { DeleteIcon, EditIcon } from "../../../shared/ui/icons/action-icons";
import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import { MetaRow } from "../../../shared/ui/report-shell/meta-row";
import type { DecisionEntry } from "../../report-sections";
import {
  canonicalStageName,
  FOREIGN_ENTRY_OPACITY,
  PublishedRecordMarker,
  splitStageNames,
} from "../../report-sections";

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : formatTimestampShort(date);
}

interface DecisionCardProps {
  readonly decision: DecisionEntry;
  readonly readOnly: boolean;
  readonly publishedLocked: boolean;
  readonly onEdit: (decision: DecisionEntry) => void;
  readonly onDelete: (id: string) => void;
}

// Stage-less product decision is a legacy anomaly — announce "No stage set".
// Activity-parented decisions are legitimately stage-less.
function stagesAriaLabel(
  stageTags: readonly string[],
  activityId: string | null | undefined,
): string {
  if (stageTags.length > 0) return `Decision stages: ${stageTags.join(", ")}`;
  return activityId != null
    ? "Decision stages: Activity — no SDLC stage"
    : "Decision stages: No stage set";
}

// The amber deadline chip and the icon-button hairline/destructive-hover ramp
// have no design token yet; naming them keeps the raw values to one site each.
const DUE_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-status-at-risk-fg)]";
const INVALID_DUE_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)]";
const ICON_BUTTON_CLASS =
  "flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[var(--card-surface-border)] bg-[var(--color-card)] p-1.5";
const EDIT_BUTTON_CLASS = `${ICON_BUTTON_CLASS} text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]`;
const DELETE_BUTTON_CLASS = `${ICON_BUTTON_CLASS} text-[var(--color-muted-foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] hover:text-[var(--color-destructive)]`;

function DueChip({ deadline }: { readonly deadline: string }) {
  const formatted = formatDeadline(deadline);
  if (formatted === null) {
    return (
      <span className={INVALID_DUE_CHIP_CLASS} role="alert">
        Due date unavailable
      </span>
    );
  }
  return <span className={DUE_CHIP_CLASS}>Due {formatted}</span>;
}

function DecisionCardHeader({
  decision,
  readOnly,
  publishedLocked,
  onEdit,
  onDelete,
}: DecisionCardProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
        {decision.productName}
      </span>
      {decision.deadline && <DueChip deadline={decision.deadline} />}
      {publishedLocked && <PublishedRecordMarker />}
      <DecisionCardActions
        decision={decision}
        readOnly={readOnly}
        publishedLocked={publishedLocked}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export function DecisionCard(props: DecisionCardProps) {
  const { decision } = props;
  const stageTags = (
    decision.stageNames && decision.stageNames.length > 0
      ? decision.stageNames
      : splitStageNames(decision.stageName)
  )
    // Heal legacy short "Dev" at render, mirroring the risk row and item card.
    .map(canonicalStageName);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--color-background)",
        opacity: decision.foreign ? FOREIGN_ENTRY_OPACITY : 1,
      }}
    >
      <DecisionCardHeader {...props} />
      <DecisionCardBody text={decision.text} impact={decision.impact} />
      <MetaRow
        authorName={decision.owner}
        stageTags={stageTags}
        ariaLabel={stagesAriaLabel(stageTags, decision.activityId)}
        foreign={false}
        emptyStageChip={
          decision.activityId != null ? "none" : "no-stage-warning"
        }
      />
    </div>
  );
}

// Own editable decision gets edit/delete; a foreign one gets the owner lock
// badge; a read-only own decision gets neither.
function DecisionCardActions({
  decision,
  readOnly,
  publishedLocked,
  onEdit,
  onDelete,
}: DecisionCardProps) {
  if (decision.foreign === true) {
    return (
      <div className="ml-auto flex gap-1">
        <LockBadge authorName={decision.owner} />
      </div>
    );
  }
  if (readOnly) return null;
  return (
    <div className="ml-auto flex gap-1">
      <button
        type="button"
        className={EDIT_BUTTON_CLASS}
        onClick={() => onEdit(decision)}
        aria-label="Edit decision"
      >
        <EditIcon />
      </button>
      {!publishedLocked && (
        <button
          type="button"
          className={DELETE_BUTTON_CLASS}
          onClick={() => onDelete(decision.id)}
          aria-label={`Delete decision for ${decision.productName}`}
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
}

function DecisionCardBody({
  text,
  impact,
}: {
  readonly text: string;
  readonly impact: string;
}) {
  return (
    <div className="space-y-2 text-sm text-[var(--color-foreground)]">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
          Decision
        </span>
        <div className="mt-0.5 break-words">
          {text || (
            <em className="text-[var(--color-muted-foreground)]">— pending</em>
          )}
        </div>
      </div>
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
          Impact
        </span>
        <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
          {impact || "—"}
        </div>
      </div>
    </div>
  );
}
