"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";
import { Lock } from "lucide-react";

import type { StageAssignment, StageStatus } from "../model/mock-data";
import {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "../model/stage-chip-config";
import { stageShortLabel } from "../model/stage-tags";

const ASSIGNEE_FONT_WEIGHT_MINE = 600;
const ASSIGNEE_FONT_WEIGHT_OTHER = 400;

interface StageChipProps {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  /**
   * The RAW, pre-floor status of this stage. `stage.status` is the floored
   * display status (a covering risk may have raised an empty/on-track stage to
   * at-risk/blocked). Threading the raw status lets the chip distinguish a
   * severity the lead set explicitly (raw !== "empty") from one that exists
   * ONLY because the lead's own risk floors an empty stage (raw === "empty" &&
   * `stage.coveredByOwnRisk`), and lets the click toggle off the raw value.
   * Defaults to the floored status for read-only / head paths that pass none.
   */
  readonly rawStatus?: StageStatus;
}

// Status/icon config lives in stage-chip-config.ts (apply-status-palette).
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
  // The raw status defaults to the floored display status for callers
  // (read-only / head) that thread no pre-floor signal. The covered/status-set
  // distinction applies only to the lead's OWN stages — a foreign-owned locked
  // chip never carries the lead's authoring intent.
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

  const borderStyle = isEmpty
    ? `1.5px dashed var(--color-starbucks-accent)`
    : // A stage floored to its severity purely by the lead's own risk reads as a
      // dashed "sketch" of the same hue — same color, not pixel-identical to a
      // status the lead explicitly set (solid).
      coveredByRisk
      ? `1.5px dashed ${config.border}`
      : `1.5px solid ${config.border}`;

  // simplify-stage-status-interaction (D1): the chip is a plain On Track ⇄ unset
  // toggle off the RAW status — no status menu. A chip whose displayed severity
  // is at-risk/blocked is floored by a covering risk; clicking it still fires the
  // toggle intent, but the sync bridge (the single owner of the risk list + the
  // toast) ignores it and points the lead at the Risks section.
  function handleChipClick() {
    if (!isEditable) return;
    const next: StageStatus =
      effectiveRawStatus === "on-track" ? "empty" : "on-track";
    onStatusChange?.(stage.stageName, next);
  }

  // simplify-stage-status-interaction (task 1.4): the coverage suffix keys off
  // the DISPLAYED status, not the raw one, and only for the lead's OWN chips (a
  // foreign-owned locked chip carries no authoring intent). at-risk/blocked come
  // only from risks now, so a mine chip showing either always reads "by risk"
  // (even one the lead set on-track that a covering risk then floored up). An
  // explicit on-track reads "status set".
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
    : // Append the coverage suffix OUTSIDE the `??` so a chip that carries an
      // explicit tooltip still gets the "by risk" / "status set" cue — the
      // dashed border must never read as unexplained to a sighted hover user.
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
            {/* User feedback 2026-06-10: no status glyph on the chip face — the
                stage icon + label carry the status through color alone (the
                tooltip/aria-label still name the status textually). The lock
                sits as a small corner badge instead of a third inline icon. */}
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

      {/* Assignee label */}
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
