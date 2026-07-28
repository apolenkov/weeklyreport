import { MetaRow } from "../../../shared/ui/report-shell/meta-row";
import type { RiskEntry, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  FOREIGN_ENTRY_OPACITY,
  splitStageNames,
} from "../../report-sections";
import { RiskCardActions, RiskCardSummary } from "./risk-card-parts";

// Prefer stageNames, fall back to legacy CSV; canonicalize so stored "Dev"
// always displays as "Development".
export function canonicalRiskStageTags(risk: {
  stageNames?: readonly string[] | null | undefined;
  stageName?: string | null | undefined;
}): string[] {
  const raw =
    risk.stageNames && risk.stageNames.length > 0
      ? risk.stageNames
      : splitStageNames(risk.stageName);
  return raw.map(canonicalStageName);
}

// Soft card washes — token vars only cover the severity chip, not the card.
const BLOCKED_CARD_BG = "#fdf8f8";
const AT_RISK_CARD_BG = "#fffcf5";
const BLOCKED_CARD_BORDER = "rgba(200,32,20,0.15)";
const AT_RISK_CARD_BORDER = "rgba(212,160,23,0.15)";

interface RiskCardProps {
  readonly risk: RiskEntry;
  readonly readOnly: boolean;
  readonly sectionAuthorName?: string | undefined;
  readonly linkedProductStatus?: StageStatus | undefined;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  // One-click blocked <-> at-risk without the full edit dialog. Omitted on
  // read-only / foreign cards (action row is a LockBadge).
  readonly onToggleSeverity?: ((risk: RiskEntry) => void) | undefined;
}

interface RiskCardState {
  isBlocked: boolean;
  // Activity-parented rows are legitimately stage-less — no warning chip.
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

function RiskSeverityChip({ isBlocked }: { readonly isBlocked: boolean }) {
  return (
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
  );
}

interface RiskCardHeaderProps {
  readonly risk: RiskEntry;
  readonly isBlocked: boolean;
  readonly locked: boolean;
  readonly sectionAuthorName?: string | undefined;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly onToggleSeverity?: ((risk: RiskEntry) => void) | undefined;
}

function RiskCardHeader({
  risk,
  isBlocked,
  locked,
  sectionAuthorName,
  onEdit,
  onDelete,
  onToggleSeverity,
}: RiskCardHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <RiskSeverityChip isBlocked={isBlocked} />
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
  );
}

export function RiskCard({
  risk,
  readOnly,
  sectionAuthorName,
  linkedProductStatus,
  onEdit,
  onDelete,
  onToggleSeverity,
}: RiskCardProps) {
  const state = deriveRiskCardState(risk, readOnly, linkedProductStatus);

  return (
    <div
      data-testid="risk-card"
      className="rounded-xl p-4"
      style={{
        background: state.isBlocked ? BLOCKED_CARD_BG : AT_RISK_CARD_BG,
        border: `1px solid ${state.isBlocked ? BLOCKED_CARD_BORDER : AT_RISK_CARD_BORDER}`,
        opacity: risk.foreign ? FOREIGN_ENTRY_OPACITY : 1,
      }}
    >
      <RiskCardHeader
        risk={risk}
        isBlocked={state.isBlocked}
        locked={state.locked}
        sectionAuthorName={sectionAuthorName}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleSeverity={onToggleSeverity}
      />
      <RiskCardSummary risk={risk} />
      {state.needsStage && (
        <p className="mt-2 text-[11px] font-semibold text-[var(--color-status-at-risk-fg)]">
          ⚠ Select at least one stage — required for at-risk/blocked products.
        </p>
      )}
      <MetaRow
        authorName={risk.authorName ?? sectionAuthorName}
        stageTags={state.stageTags}
        ariaLabel={`Risk stages: ${state.stageTagsLabel}`}
        foreign={false}
        emptyStageChip={state.isActivityRisk ? "none" : "no-stage-warning"}
      />
    </div>
  );
}
