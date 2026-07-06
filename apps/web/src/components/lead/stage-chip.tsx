"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StageAssignment, StageStatus } from "./mock-data";
import {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "./stage-chip-config";
import { StageChipMenu } from "./stage-chip-menu";
import { stageShortLabel } from "./stage-tags";

const POPOVER_OFFSET_PX = 4;
const ASSIGNEE_FONT_WEIGHT_MINE = 600;
const ASSIGNEE_FONT_WEIGHT_OTHER = 400;

interface StageChipProps {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  /**
   * W11 (fix-report-surface-integrity 3.9): the RAW, pre-floor status of this
   * stage. `stage.status` is the floored display status (risk floor may have
   * raised an empty stage to at-risk/blocked). Threading the raw status lets
   * the chip distinguish a severity the lead set explicitly (raw !== "empty")
   * from one that exists ONLY because the lead's own risk floors an empty
   * stage (raw === "empty" && `stage.coveredByOwnRisk`). Defaults to the
   * floored status for read-only / head paths that pass no raw signal.
   */
  readonly rawStatus?: StageStatus;
  /**
   * Per-severity "click routes through risk creation" flags for the menu.
   * True when the bridge's raise interception would open the risk dialog
   * instead of applying the status (no sufficient covering risk). The menu
   * labels those options with a "→ create risk" hint so the routing is
   * announced, not a surprise. Omitted on read-only / head paths.
   */
  readonly riskGap?: { readonly "at-risk": boolean; readonly blocked: boolean };
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
  riskGap,
}: StageChipProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIG[stage.status];
  const isEditable = stage.ownership === "mine" && !readOnly;
  const isLocked = stage.ownership === "locked";
  const isEmpty = stage.status === "empty" && isEditable;
  // W11 (3.9): the raw status defaults to the floored display status for
  // callers (read-only / head) that thread no pre-floor signal. The
  // covered/status-set distinction applies only to the lead's OWN stages —
  // a foreign-owned locked chip never carries the lead's authoring intent.
  const isMine = stage.ownership === "mine";
  const effectiveRawStatus = rawStatus ?? stage.status;
  const coveredByRisk =
    isMine && effectiveRawStatus === "empty" && stage.coveredByOwnRisk === true;
  const isExplicitlySet = isMine && effectiveRawStatus !== "empty";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const chipContains = dropdownRef.current?.contains(target);
      const portalContains = portalRef.current?.contains(target);
      if (!chipContains && !portalContains) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  // Position popover via portal to escape accordion overflow:hidden.
  useEffect(() => {
    if (!showPopover) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setPopoverPos({ top: r.bottom + POPOVER_OFFSET_PX, left: r.left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showPopover]);

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
    : // W11 (3.9): a stage floored to its severity purely by the lead's own
      // risk reads as a dashed "sketch" of the same hue — same color, not
      // pixel-identical to a status the lead explicitly set (solid).
      coveredByRisk
      ? `1.5px dashed ${config.border}`
      : `1.5px solid ${config.border}`;

  function handleChipClick() {
    if (!isEditable) return;
    setShowPopover(!showPopover);
  }

  function applyStatus(next: StageStatus) {
    if (!isEditable) return;
    if (next === stage.status) {
      setShowPopover(false);
      return;
    }
    // Every transition applies on the first click here. Conflicting
    // transitions (raise without a covering risk, lower a covered chip)
    // are intercepted upstream by lead-form-sync-bridge
    // (unify-risk-stage-status D2/D3), which owns the dialogs.
    onStatusChange?.(stage.stageName, next);
    setShowPopover(false);
  }

  // TODO(why-status): deferred per-stage "why this status" affordance — attribute
  // a chip's color to the specific covering risk/blocker in this tooltip
  // composition (lead-mine-hide-unowned-stages, Out of scope; user decision
  // 2026-06-18). The existing coverage suffix below ("by risk" / "status set")
  // stays; no risk-attribution UI is built here yet.
  // W11 (3.9): three-way coverage suffix carried by BOTH the screen-reader
  // label and the visible tooltip.
  //  - covered by the lead's OWN risk on an empty stage → "<status> by risk"
  //  - a status the lead set explicitly → "<status> — status set"
  //  - foreign floor / locked → no suffix (plain status)
  const coverageSuffix = coveredByRisk
    ? " by risk"
    : isExplicitlySet
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
    <div
      className="flex flex-col items-center gap-1 min-w-[90px]"
      ref={dropdownRef}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
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
                popover/tooltip/aria-label still name the status textually).
                The lock sits as a small corner badge instead of a third inline
                icon. */}
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

      {/* Status popover — click-to-apply menu (StageChipMenu). The
          Save/Cancel form was an earlier iteration the user reverted: for a
          4-option enum the form felt heavier than the action it gated. */}
      {showPopover && popoverPos && (
        <StageChipMenu
          stageName={stage.stageName}
          currentStatus={stage.status}
          position={popoverPos}
          portalRef={portalRef}
          riskGap={riskGap}
          onApply={applyStatus}
        />
      )}
    </div>
  );
}
