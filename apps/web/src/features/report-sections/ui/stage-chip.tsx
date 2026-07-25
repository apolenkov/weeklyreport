"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";
import { Lock } from "lucide-react";

import {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "../model/stage-chip-config";
import { stageShortLabel } from "../model/stage-tags";
import type { StageAssignment, StageStatus } from "../model/types";

const ASSIGNEE_FONT_WEIGHT_MINE = 600;
const ASSIGNEE_FONT_WEIGHT_OTHER = 400;

interface StageChipProps {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  // Pre-floor status: distinguishes explicit set vs own-risk floor; click toggles raw.
  // Defaults to floored status for read-only/head paths that pass none.
  readonly rawStatus?: StageStatus;
}

function StageIconGlyph({ stageName }: { readonly stageName: string }) {
  const StageIcon = STAGE_ICONS[stageName];
  if (!StageIcon) return null;
  return (
    <StageIcon
      className="mr-1 inline-block h-[12px] w-[12px] align-[-1px]"
      aria-hidden="true"
    />
  );
}

export function StageChip({
  stage,
  onStatusChange,
  readOnly = false,
  rawStatus,
}: StageChipProps) {
  const config = STATUS_CONFIG[stage.status];
  const isEditable = stage.ownership === "mine" && !readOnly;
  const isLocked = stage.ownership === "locked";
  const isEmpty = stage.status === "empty" && isEditable;
  // Covered/status-set only applies to own stages; locked chips carry no authoring intent.
  const isMine = stage.ownership === "mine";
  const effectiveRawStatus = rawStatus ?? stage.status;
  const coveredByRisk =
    isMine && effectiveRawStatus === "empty" && stage.coveredByOwnRisk === true;

  const chipClasses = [
    "relative w-full max-md:min-h-[var(--touch-target-min)] p-2 rounded-lg inline-flex items-center justify-center text-xs font-semibold transition-[background-color,border-color,box-shadow,opacity,filter] duration-150",
    isEditable && !isEmpty
      ? "cursor-pointer hover:opacity-80 hover:saturate-50 hover:shadow-[0_0_0_2.5px_rgba(0,0,0,0.12)]"
      : "",
    isEmpty
      ? "cursor-pointer border-dashed animate-[sdlc-pulse_3s_infinite] motion-reduce:animate-none hover:animate-none hover:shadow-[0_0_0_2px_rgba(0,117,74,0.2)]"
      : "",
    isLocked ? "cursor-not-allowed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Own-risk floor = dashed sketch of the same hue; explicit set = solid.
  const borderStyle = isEmpty
    ? `1.5px dashed var(--color-starbucks-accent)`
    : coveredByRisk
      ? `1.5px dashed ${config.border}`
      : `1.5px solid ${config.border}`;

  // Toggle is on-track ⇄ empty off RAW status. Risk-floored chips still fire
  // the click; the sync bridge ignores it and points the lead at Risks.
  function handleChipClick() {
    if (!isEditable) return;
    const next: StageStatus =
      effectiveRawStatus === "on-track" ? "empty" : "on-track";
    onStatusChange?.(stage.stageName, next);
  }

  // Suffix uses displayed status on own chips: at-risk/blocked → "by risk", on-track → "status set".
  const coverageSuffix = !isMine
    ? ""
    : stage.status === "at-risk" || stage.status === "blocked"
      ? " by risk"
      : stage.status === "on-track"
        ? " — status set"
        : "";
  const ariaLabel = `${stage.stageName}: ${stage.status}${coverageSuffix}`;
  const baseTooltip = stage.tooltip ?? `${stage.stageName} · ${stage.status}`;

  const title = isLocked
    ? [
        `Locked — owned by ${stage.assignee ?? "another lead"}`,
        "You don't have edit permissions",
      ]
        .filter(Boolean)
        .join(" · ")
    : // Append outside ?? so an explicit tooltip still gets the coverage cue.
      `${baseTooltip}${coverageSuffix}`;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[90px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={chipClasses}
            style={{
              height: STAGE_CHIP_BOX_HEIGHT,
              background: config.bg,
              color: config.text,
              border: borderStyle,
            }}
            aria-label={ariaLabel}
            data-coverage={coveredByRisk ? "risk" : undefined}
            onClick={handleChipClick}
            aria-disabled={!isEditable}
            tabIndex={isEditable || isLocked ? 0 : -1}
          >
            {/* Status via color only; lock is a corner badge, not a third inline icon. */}
            <StageIconGlyph stageName={stage.stageName} />
            {stageShortLabel(stage.stageName)}
            {isLocked && (
              <span
                className="absolute -top-1.5 -right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[rgba(0,0,0,0.12)] bg-white"
                aria-hidden="true"
              >
                <Lock className="h-[9px] w-[9px] text-[var(--color-muted-foreground)]" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>

      <span
        className="text-[11px]"
        style={{
          color:
            stage.ownership === "mine"
              ? "var(--color-starbucks-accent)"
              : "var(--color-muted-foreground)",
          fontWeight:
            stage.ownership === "mine"
              ? ASSIGNEE_FONT_WEIGHT_MINE
              : ASSIGNEE_FONT_WEIGHT_OTHER,
        }}
      >
        {stage.assignee ?? "—"}
      </span>
    </div>
  );
}
