import { MetaRow } from "../../../shared/ui/report-shell/meta-row";
import type { RiskEntry, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  FOREIGN_ENTRY_OPACITY,
  splitStageNames,
} from "../../report-sections";
import { RiskCardActions, RiskCardSummary } from "./risk-card-parts";

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
        <RiskCardActions
          risk={risk}
          sectionAuthorName={sectionAuthorName}
          locked={locked}
          isBlocked={isBlocked}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleSeverity={onToggleSeverity}
        />
      </div>
      <RiskCardSummary risk={risk} />
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
