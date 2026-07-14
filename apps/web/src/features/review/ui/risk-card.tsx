import { ArrowDownUp } from "lucide-react";

import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import { MetaRow } from "../../../shared/ui/report-shell/meta-row";
import type { RiskEntry, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  FOREIGN_ENTRY_OPACITY,
  splitStageNames,
} from "../../report-sections";
import { DeleteIcon, EditIcon } from "./risk-card-icons";

/**
 * The canonical, display-ready stage tags for a risk (stage-label-canonicalization):
 * prefer stageIds, fall back to the legacy CSV, canonicalize every value so a
 * stored "Dev" reads as "Development" everywhere it is shown.
 */
export function canonicalRiskStageTags(risk: {
  stageIds?: readonly string[] | null;
  stageName?: string | null;
}): string[] {
  const raw =
    risk.stageIds && risk.stageIds.length > 0
      ? risk.stageIds
      : splitStageNames(risk.stageName);
  return raw.map(canonicalStageName);
}

interface RiskCardProps {
  readonly risk: RiskEntry;
  readonly readOnly: boolean;
  readonly sectionAuthorName?: string;
  readonly linkedProductStatus?: StageStatus;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  /**
   * simplify-stage-status-interaction: one-click blocked <-> at-risk severity
   * flip, without opening the full edit dialog. Omitted on read-only / foreign
   * cards (their action row is a LockBadge, not buttons).
   */
  readonly onToggleSeverity?: (risk: RiskEntry) => void;
}

interface RiskCardState {
  isBlocked: boolean;
  /** Activity-parented rows are legitimately stage-less — no warning chip. */
  isActivityRisk: boolean;
  stageTags: string[];
  stageTagsLabel: string;
  needsStage: boolean;
  locked: boolean;
}

function deriveRiskCardState(
  risk: RiskEntry,
  readOnly: boolean,
  linkedProductStatus: RiskCardProps["linkedProductStatus"],
): RiskCardState {
  const stageTags = canonicalRiskStageTags(risk);
  // An activity-parented risk is legitimately stage-less (activities carry no
  // SDLC stage) — no warning chip, no stage nudge.
  const isActivityRisk = risk.activityId != null;
  // A PRODUCT risk with no stages is an anomaly (legacy row), never an
  // implicit "all stages" scope — render the loud "No stage set" warning chip
  // instead of disguising it. Keep every selected stage visible; seven SDLC
  // chips fit better than hiding critical scope behind "+N".
  const stageTagsLabel =
    stageTags.length > 0
      ? stageTags.join(", ")
      : isActivityRisk
        ? "Activity — no SDLC stage"
        : "No stage set";
  // Warn when the linked product is at-risk/blocked but no explicit stage is
  // selected for this risk row.
  const needsStage =
    !readOnly &&
    !isActivityRisk &&
    (linkedProductStatus === "at-risk" || linkedProductStatus === "blocked") &&
    stageTags.length === 0;
  return {
    isBlocked: risk.severity === "blocked",
    isActivityRisk,
    stageTags,
    stageTagsLabel,
    needsStage,
    locked: readOnly || risk.foreign === true,
  };
}

/**
 * One risk card: severity/product header, edit + delete actions (or a foreign
 * LockBadge when locked), the risk/impact/mitigation summary, the "select a
 * stage" warning, and the unified author + stage meta-row.
 */
export function RiskCard({
  risk,
  readOnly,
  sectionAuthorName,
  linkedProductStatus,
  onEdit,
  onDelete,
  onToggleSeverity,
}: RiskCardProps) {
  const {
    isBlocked,
    isActivityRisk,
    stageTags,
    stageTagsLabel,
    needsStage,
    locked,
  } = deriveRiskCardState(risk, readOnly, linkedProductStatus);

  return (
    <div
      data-testid="risk-card"
      className="rounded-xl p-4"
      style={{
        background: isBlocked ? "#fdf8f8" : "#fffcf5",
        border: `1px solid ${isBlocked ? "rgba(200,32,20,0.15)" : "rgba(212,160,23,0.15)"}`,
        opacity: risk.foreign ? FOREIGN_ENTRY_OPACITY : 1,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: isBlocked
              ? "var(--color-status-blocked-bg)"
              : "var(--color-status-at-risk-bg)",
            color: isBlocked
              ? "var(--color-destructive)"
              : "var(--color-status-at-risk-fg)",
          }}
        >
          {isBlocked ? "Blocked" : "At Risk"}
        </span>
        <span className="font-[family-name:var(--font-sans)] text-sm font-semibold break-words">
          {risk.productName}
        </span>
        {!locked ? (
          <div className="ml-auto flex gap-1">
            {onToggleSeverity && (
              <button
                type="button"
                className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
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
              className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
              onClick={() => onEdit(risk)}
              aria-label={`Edit risk for ${risk.productName}`}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
              onClick={() => onDelete(risk.id)}
              aria-label={`Delete risk for ${risk.productName}`}
            >
              <DeleteIcon />
            </button>
          </div>
        ) : risk.foreign === true ? (
          <div className="ml-auto flex gap-1">
            <LockBadge authorName={risk.authorName ?? sectionAuthorName} />
          </div>
        ) : null}
      </div>
      {/* Risk + impact + mitigation summary — read-only on the
          card; the dialog is the only edit surface so we can
          validate all three fields together. */}
      <div className="space-y-2 text-sm text-[var(--color-foreground)]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Risk
          </span>
          <div className="mt-0.5 break-words">
            {risk.text || (
              <em className="text-[var(--color-muted-foreground)]">
                — pending
              </em>
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
      {/* Required-mark when product is at-risk/blocked but no stage selected */}
      {needsStage && (
        <p className="mt-2 text-[11px] font-semibold text-[var(--color-status-at-risk-fg)]">
          ⚠ Select at least one stage — required for at-risk/blocked products.
        </p>
      )}
      {/* Unified [author …… chip] meta-row */}
      <MetaRow
        authorName={risk.authorName ?? sectionAuthorName}
        stageTags={stageTags}
        ariaLabel={`Risk stages: ${stageTagsLabel}`}
        foreign={false}
        emptyStageChip={isActivityRisk ? "none" : "no-stage-warning"}
      />
    </div>
  );
}
