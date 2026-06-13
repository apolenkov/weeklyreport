"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useSdlcTooltip } from "../ui/sdlc-tooltip";
import type { StageAssignment, StageStatus } from "./mock-data";
import {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
  STATUS_OPTIONS,
} from "./stage-chip-config";

interface StageChipProps {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  /** Cross-author stats shown in the tooltip when the stage is locked. */
  readonly crossAuthorInfo?: { itemCount: number; riskCount: number };
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
  crossAuthorInfo,
}: StageChipProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const tooltip = useSdlcTooltip();
  const config = STATUS_CONFIG[stage.status];
  const isEditable = stage.ownership === "mine" && !readOnly;
  const isLocked = stage.ownership === "locked";
  const isUnassigned = stage.ownership === "unassigned";
  const isEmpty = stage.status === "empty" && isEditable;

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
      setPopoverPos({ top: r.bottom + 4, left: r.left });
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
    "relative w-full p-2 rounded-lg inline-flex items-center justify-center text-xs font-semibold transition-[background-color,border-color,box-shadow,opacity,filter] duration-150",
    isEditable && !isEmpty
      ? "cursor-pointer hover:opacity-80 hover:saturate-50 hover:shadow-[0_0_0_2.5px_rgba(0,0,0,0.12)]"
      : "",
    isEmpty
      ? "cursor-pointer border-dashed animate-[sdlc-pulse_3s_infinite] motion-reduce:animate-none hover:animate-none hover:shadow-[0_0_0_2px_rgba(0,117,74,0.2)]"
      : "",
    isLocked ? "cursor-not-allowed" : "",
    isUnassigned ? "cursor-not-allowed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const borderStyle = isEmpty
    ? `1.5px dashed var(--color-starbucks-accent)`
    : isUnassigned
      ? "1.5px dashed rgba(0,0,0,0.15)"
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

  const lockSuffix =
    isLocked && crossAuthorInfo
      ? [
          crossAuthorInfo.itemCount > 0
            ? `${crossAuthorInfo.itemCount} item${crossAuthorInfo.itemCount !== 1 ? "s" : ""}`
            : null,
          crossAuthorInfo.riskCount > 0
            ? `${crossAuthorInfo.riskCount} risk${crossAuthorInfo.riskCount !== 1 ? "s" : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const title = isLocked
    ? [
        `Locked — owned by ${stage.assignee ?? "another lead"}`,
        lockSuffix,
        "You don't have edit permissions",
      ]
        .filter(Boolean)
        .join(" · ")
    : isUnassigned
      ? "Unassigned · Contact admin"
      : (stage.tooltip ?? `${stage.stageName} · ${stage.status}`);

  function handleEnter() {
    const el = buttonRef.current;
    if (!el) return;
    tooltip.show(el.getBoundingClientRect(), title);
  }

  function handleLeave() {
    tooltip.hide();
  }

  return (
    <div
      className="flex flex-col items-center gap-1 min-w-[90px]"
      ref={dropdownRef}
    >
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
        aria-label={`${stage.stageName}: ${stage.status}`}
        onClick={handleChipClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        aria-disabled={!isEditable}
        tabIndex={isEditable || isLocked ? 0 : -1}
      >
        {/* User feedback 2026-06-10: no status glyph on the chip face — the
            stage icon + label carry the status through color alone (the
            popover/tooltip/aria-label still name the status textually).
            The lock sits as a small corner badge instead of a third inline
            icon. */}
        <StageIconGlyph stageName={stage.stageName} />
        {stage.stageName}
        {isLocked && (
          <span
            className="absolute -top-1.5 -right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[rgba(0,0,0,0.12)] bg-white"
            aria-hidden="true"
          >
            <Lock className="h-[9px] w-[9px] text-[var(--color-muted-foreground)]" />
          </span>
        )}
      </button>

      {/* Assignee label */}
      <span
        className="text-[11px]"
        style={{
          color:
            stage.ownership === "mine"
              ? "var(--color-starbucks-accent)"
              : "var(--color-muted-foreground)",
          fontWeight: stage.ownership === "mine" ? 600 : 400,
        }}
      >
        {isUnassigned ? "— unassigned" : stage.assignee}
      </span>

      {/* Status popover — click-to-apply menu. Each option is a single
          tap; the popover closes immediately. Portaled to body to escape
          accordion overflow:hidden. The Save/Cancel form was an earlier
          iteration the user reverted: for a 4-option enum the form felt
          heavier than the action it gated. Transitions that need a second
          step (raise without a risk, lower a covered chip) are intercepted
          by lead-form-sync-bridge, not here. */}
      {showPopover &&
        popoverPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-50 w-[180px] rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            role="menu"
            aria-label={`Set status for ${stage.stageName}`}
          >
            {STATUS_OPTIONS.map((opt) => {
              const cfg = STATUS_CONFIG[opt.value];
              const isCurrent = stage.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => applyStatus(opt.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={{
                    background: isCurrent ? cfg.bg : "transparent",
                    color: isCurrent ? cfg.text : "var(--color-foreground)",
                  }}
                >
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: cfg.bg,
                      color: cfg.text,
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    {cfg.icon}
                  </span>
                  <span className="flex-1">
                    {opt.label.replace(/^[^\s]+\s/, "")}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      current
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
