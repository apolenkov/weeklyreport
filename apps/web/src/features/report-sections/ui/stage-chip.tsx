"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";
import { Lock } from "lucide-react";
import type { CSSProperties } from "react";

import {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "../model/stage-chip-config";
import { stageShortLabel } from "../model/stage-tags";
import type { StageAssignment, StageStatus } from "../model/types";

const ASSIGNEE_FONT_WEIGHT_MINE = 600;
const ASSIGNEE_FONT_WEIGHT_OTHER = 400;

const CHIP_BASE_CLASSES =
  "relative w-full max-md:min-h-[var(--touch-target-min)] p-2 rounded-lg inline-flex items-center justify-start gap-2 text-left text-xs font-semibold transition-[background-color,border-color,box-shadow,opacity,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1";
const CHIP_EDITABLE_CLASSES =
  "cursor-pointer hover:opacity-80 hover:saturate-50 hover:shadow-[0_0_0_2.5px_var(--card-surface-border)]";
const CHIP_EMPTY_CLASSES =
  "cursor-pointer border-dashed animate-[sdlc-pulse_3s_infinite] motion-reduce:animate-none hover:animate-none hover:shadow-[var(--shadow-stage-empty-hover)]";
const CHIP_LOCKED_CLASSES = "cursor-not-allowed";

interface StageChipProps {
  readonly stage: StageAssignment;
  readonly onStatusChange?:
    ((stageName: string, newStatus: StageStatus) => void) | undefined;
  readonly readOnly?: boolean | undefined;
  // Pre-floor status: distinguishes explicit set vs own-risk floor; click toggles raw.
  // Defaults to floored status for read-only/head paths that pass none.
  readonly rawStatus?: StageStatus | undefined;
}

interface ChipAffordances {
  readonly isEditable: boolean;
  readonly isEmpty: boolean;
  readonly isLocked: boolean;
}

function chipClassName({
  isEditable,
  isEmpty,
  isLocked,
}: ChipAffordances): string {
  return [
    CHIP_BASE_CLASSES,
    isEditable && !isEmpty ? CHIP_EDITABLE_CLASSES : "",
    isEmpty ? CHIP_EMPTY_CLASSES : "",
    isLocked ? CHIP_LOCKED_CLASSES : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// Own-risk floor = dashed sketch of the same hue; explicit set = solid.
function chipBorderStyle(
  isEmpty: boolean,
  coveredByRisk: boolean,
  borderColor: string,
): string {
  if (isEmpty) return `1.5px dashed var(--color-starbucks-accent)`;
  return coveredByRisk
    ? `1.5px dashed ${borderColor}`
    : `1.5px solid ${borderColor}`;
}

function chipStyle({
  status,
  isEmpty,
  coveredByRisk,
}: {
  readonly status: StageStatus;
  readonly isEmpty: boolean;
  readonly coveredByRisk: boolean;
}): CSSProperties {
  const config = STATUS_CONFIG[status];
  return {
    height: STAGE_CHIP_BOX_HEIGHT,
    background: config.bg,
    color: config.text,
    border: chipBorderStyle(isEmpty, coveredByRisk, config.border),
  };
}

// Suffix uses displayed status on own chips: at-risk/blocked → "by risk",
// on-track → "status set". Foreign/locked chips carry no authoring intent.
function coverageSuffixFor(stage: StageAssignment): string {
  if (stage.ownership !== "mine") return "";
  if (stage.status === "at-risk" || stage.status === "blocked") {
    return " by risk";
  }
  return stage.status === "on-track" ? " — status set" : "";
}

function chipTitle(stage: StageAssignment, coverageSuffix: string): string {
  if (stage.ownership === "locked") {
    return [
      `Locked — owned by ${stage.assignee ?? "another lead"}`,
      "You don't have edit permissions",
    ].join(" · ");
  }
  // Append outside ?? so an explicit tooltip still gets the coverage cue.
  const baseTooltip = stage.tooltip ?? `${stage.stageName} · ${stage.status}`;
  return `${baseTooltip}${coverageSuffix}`;
}

function StageIconGlyph({ stageName }: { readonly stageName: string }) {
  const StageIcon = STAGE_ICONS[stageName];
  if (!StageIcon) return null;
  return (
    <StageIcon
      className="inline-block h-[12px] w-[12px] shrink-0"
      aria-hidden="true"
    />
  );
}

function LockBadge() {
  return (
    <span
      className="absolute -top-1.5 -right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--card-surface-border)] bg-[var(--color-card)]"
      aria-hidden="true"
    >
      <Lock className="h-[9px] w-[9px] text-[var(--color-muted-foreground)]" />
    </span>
  );
}

function AssigneeLabel({ stage }: { readonly stage: StageAssignment }) {
  const isMine = stage.ownership === "mine";
  return (
    <span
      className="text-[11px]"
      style={{
        color: isMine
          ? "var(--color-starbucks-accent)"
          : "var(--color-muted-foreground)",
        fontWeight: isMine
          ? ASSIGNEE_FONT_WEIGHT_MINE
          : ASSIGNEE_FONT_WEIGHT_OTHER,
      }}
    >
      {stage.assignee ?? "—"}
    </span>
  );
}

interface ChipVisualState extends ChipAffordances {
  readonly effectiveRawStatus: StageStatus;
  readonly coveredByRisk: boolean;
  readonly coverageSuffix: string;
}

// Coverage only applies to own stages; locked chips carry no authoring intent.
function chipVisualState(
  stage: StageAssignment,
  readOnly: boolean,
  rawStatus: StageStatus | undefined,
): ChipVisualState {
  const isEditable = stage.ownership === "mine" && !readOnly;
  const effectiveRawStatus = rawStatus ?? stage.status;
  return {
    isEditable,
    isLocked: stage.ownership === "locked",
    isEmpty: stage.status === "empty" && isEditable,
    effectiveRawStatus,
    coveredByRisk:
      stage.ownership === "mine" &&
      effectiveRawStatus === "empty" &&
      stage.coveredByOwnRisk === true,
    coverageSuffix: coverageSuffixFor(stage),
  };
}

export function StageChip({
  stage,
  onStatusChange,
  readOnly = false,
  rawStatus,
}: StageChipProps) {
  const {
    isEditable,
    isEmpty,
    isLocked,
    effectiveRawStatus,
    coveredByRisk,
    coverageSuffix,
  } = chipVisualState(stage, readOnly, rawStatus);

  // Toggle is on-track ⇄ empty off RAW status. Risk-floored chips still fire
  // the click; the sync bridge ignores it and points the lead at Risks.
  function handleChipClick() {
    if (!isEditable) return;
    const next: StageStatus =
      effectiveRawStatus === "on-track" ? "empty" : "on-track";
    onStatusChange?.(stage.stageName, next);
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={chipClassName({ isEditable, isEmpty, isLocked })}
            style={chipStyle({ status: stage.status, isEmpty, coveredByRisk })}
            aria-label={`${stage.stageName}: ${stage.status}${coverageSuffix}`}
            data-coverage={coveredByRisk ? "risk" : undefined}
            onClick={handleChipClick}
            aria-disabled={!isEditable}
            tabIndex={isEditable || isLocked ? 0 : -1}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <StageIconGlyph stageName={stage.stageName} />
              <span className="min-w-0 truncate">
                {stageShortLabel(stage.stageName)}
              </span>
            </span>
            <span
              aria-hidden="true"
              data-testid="stage-status-glyph"
              data-status={stage.status}
              className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/25 text-[11px] font-bold"
            >
              {STATUS_CONFIG[stage.status].icon}
            </span>
            {isLocked && <LockBadge />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{chipTitle(stage, coverageSuffix)}</TooltipContent>
      </Tooltip>

      <span className="self-start px-2">
        <AssigneeLabel stage={stage} />
      </span>
    </div>
  );
}
