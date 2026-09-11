import { ArrowDownUp } from "lucide-react";

import { DeleteIcon, EditIcon } from "../../../shared/ui/icons/action-icons";
import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import type { RiskEntry } from "../../report-sections";

const ACTION_BUTTON_CLASS =
  "flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[var(--card-surface-border)] bg-[var(--color-card)] p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2";
const DEFAULT_ACTION_HOVER_CLASS =
  "text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]";
const DESTRUCTIVE_ACTION_HOVER_CLASS =
  "text-[var(--color-muted-foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] hover:text-[var(--color-destructive)]";

interface ToggleSeverityButtonProps {
  readonly risk: RiskEntry;
  readonly isBlocked: boolean;
  readonly onToggleSeverity: (risk: RiskEntry) => void;
}

// Severity flips both ways from one control; the label states the destination.
function ToggleSeverityButton({
  risk,
  isBlocked,
  onToggleSeverity,
}: ToggleSeverityButtonProps) {
  return (
    <button
      type="button"
      className={`${ACTION_BUTTON_CLASS} ${DEFAULT_ACTION_HOVER_CLASS}`}
      onClick={() => onToggleSeverity(risk)}
      aria-label={
        isBlocked
          ? `Downgrade risk for ${risk.productName} to at risk`
          : `Escalate risk for ${risk.productName} to blocked`
      }
    >
      <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

interface RiskCardActionsProps {
  readonly risk: RiskEntry;
  readonly sectionAuthorName?: string | undefined;
  readonly locked: boolean;
  readonly isBlocked: boolean;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly onToggleSeverity?: ((risk: RiskEntry) => void) | undefined;
}

export function RiskCardActions({
  risk,
  sectionAuthorName,
  locked,
  isBlocked,
  onEdit,
  onDelete,
  onToggleSeverity,
}: RiskCardActionsProps) {
  if (locked) {
    return risk.foreign === true ? (
      <div className="ml-auto flex gap-1">
        <LockBadge authorName={risk.authorName ?? sectionAuthorName} />
      </div>
    ) : null;
  }
  return (
    <div className="ml-auto flex gap-1">
      {onToggleSeverity && (
        <ToggleSeverityButton
          risk={risk}
          isBlocked={isBlocked}
          onToggleSeverity={onToggleSeverity}
        />
      )}
      <button
        type="button"
        className={`${ACTION_BUTTON_CLASS} ${DEFAULT_ACTION_HOVER_CLASS}`}
        onClick={() => onEdit(risk)}
        aria-label={`Edit risk for ${risk.productName}`}
      >
        <EditIcon />
      </button>
      <button
        type="button"
        className={`${ACTION_BUTTON_CLASS} ${DESTRUCTIVE_ACTION_HOVER_CLASS}`}
        onClick={() => onDelete(risk.id)}
        aria-label={`Delete risk for ${risk.productName}`}
      >
        <DeleteIcon />
      </button>
    </div>
  );
}

interface RiskCardSummaryProps {
  readonly risk: RiskEntry;
}

// Risk prose and stage assignments are edited through the dialog.
export function RiskCardSummary({ risk }: RiskCardSummaryProps) {
  return (
    <div className="space-y-2 text-sm text-[var(--color-foreground)]">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
          Risk
        </span>
        <div className="mt-0.5 break-words">
          {risk.text || (
            <em className="text-[var(--color-muted-foreground)]">— pending</em>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Impact
          </span>
          <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
            {risk.impact || "—"}
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Mitigation
          </span>
          <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
            {risk.mitigation || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
