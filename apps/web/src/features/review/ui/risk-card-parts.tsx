import { ArrowDownUp } from "lucide-react";

import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import type { RiskEntry } from "../../report-sections";
import { DeleteIcon, EditIcon } from "./risk-card-icons";

const ACTION_BUTTON_CLASS =
  "flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5";
const DEFAULT_ACTION_HOVER_CLASS =
  "text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]";
const DESTRUCTIVE_ACTION_HOVER_CLASS =
  "text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]";

interface RiskCardActionsProps {
  readonly risk: RiskEntry;
  readonly sectionAuthorName?: string;
  readonly locked: boolean;
  readonly isBlocked: boolean;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly onToggleSeverity?: (risk: RiskEntry) => void;
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

// Dialog is the only edit surface — summary is always read-only.
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
