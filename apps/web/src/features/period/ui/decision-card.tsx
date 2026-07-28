import { formatTimestampShort } from "../../../lib/format-date";
import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import { MetaRow } from "../../../shared/ui/report-shell/meta-row";
import type { DecisionEntry } from "../../report-sections";
import {
  canonicalStageName,
  FOREIGN_ENTRY_OPACITY,
  PublishedRecordMarker,
  splitStageNames,
} from "../../report-sections";

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

// Deadlines are stored as UTC date-only values, so the chip formats in UTC —
// a local-zone render shows the previous day for viewers west of UTC.
function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatTimestampShort(date);
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
  "inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a6d1b]";
const ICON_BUTTON_CLASS =
  "flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5";
const EDIT_BUTTON_CLASS = `${ICON_BUTTON_CLASS} text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]`;
const DELETE_BUTTON_CLASS = `${ICON_BUTTON_CLASS} text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]`;

function DueChip({ deadline }: { readonly deadline: string }) {
  return <span className={DUE_CHIP_CLASS}>Due {formatDeadline(deadline)}</span>;
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
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(decision.stageName)
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
