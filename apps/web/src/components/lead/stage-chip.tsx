"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";

import { useSdlcTooltip } from "../ui/sdlc-tooltip";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import type { StageAssignment, StageStatus } from "./mock-data";

type StageChipProps = {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  /**
   * Number of risks currently associated with this stage (within the stage's
   * product). Surfaces as a confirmation prompt when the user picks "Clear"
   * — clearing a stage implicitly orphans those risks, so we ask first.
   */
  readonly linkedRiskCount?: number;
  /** Cross-author stats shown in the tooltip when the stage is locked. */
  readonly crossAuthorInfo?: { itemCount: number; riskCount: number };
};

const STATUS_CONFIG: Record<
  StageStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  "on-track": {
    icon: "✓",
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    border: "var(--color-starbucks-accent)",
  },
  "at-risk": {
    icon: "!",
    bg: "#fef3c7",
    text: "#8a6d1b",
    border: "#d4a017",
  },
  blocked: {
    icon: "✕",
    bg: "#fee2e2",
    text: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
  empty: {
    icon: "○",
    bg: "#f8f6f2",
    text: "var(--color-muted-foreground)",
    border: "rgba(0,0,0,0.15)",
  },
};

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: "on-track", label: "✓ On Track" },
  { value: "at-risk", label: "! At Risk" },
  { value: "blocked", label: "✕ Blocked" },
  { value: "empty", label: "○ Clear" },
];

export function StageChip({
  stage,
  onStatusChange,
  readOnly = false,
  linkedRiskCount = 0,
  crossAuthorInfo,
}: StageChipProps) {
  const [showPopover, setShowPopover] = useState(false);
  // Confirm modal for the only case that warrants a second click —
  // clearing a stage that still has linked risks. The other three
  // options apply immediately on click.
  const [pendingClear, setPendingClear] = useState(false);
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
    "w-full p-2 rounded-lg text-center text-xs font-semibold transition-[background-color,border-color,box-shadow,opacity,filter] duration-150",
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

  const borderStyle =
    isEmpty && isEditable
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
    // Clearing a stage that still has linked risks needs a confirm —
    // the risks themselves persist but the chip-level signal is dropped.
    // Every other transition applies on the first click.
    if (next === "empty" && linkedRiskCount > 0) {
      setPendingClear(true);
      return;
    }
    onStatusChange?.(stage.stageName, next);
    setShowPopover(false);
  }

  function confirmClear() {
    onStatusChange?.(stage.stageName, "empty");
    setPendingClear(false);
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
    ? [stage.assignee ?? "Unknown", lockSuffix, "No edit permissions"]
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
        disabled={!isEditable}
        tabIndex={isEditable ? 0 : -1}
      >
        {config.icon} {stage.stageName}
        {isLocked && (
          <Lock
            className="ml-1 inline-block h-[11px] w-[11px] opacity-50"
            aria-hidden="true"
          />
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
          heavier than the action it gated. The Clear-with-linked-risks
          confirm is the one place where a second click is still
          warranted, and that path uses ConfirmDeleteDialog below. */}
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

      <ConfirmDeleteDialog
        open={pendingClear}
        title="Clear this stage?"
        preview={stage.stageName}
        subtitle={`${linkedRiskCount} linked risk${linkedRiskCount === 1 ? "" : "s"} will stay — only the chip's status is reset.`}
        confirmLabel="Clear"
        reversible
        onConfirm={confirmClear}
        onCancel={() => setPendingClear(false)}
      />
    </div>
  );
}
