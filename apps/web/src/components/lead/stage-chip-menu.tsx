"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";

import type { StageStatus } from "./mock-data";
import { STATUS_CONFIG, STATUS_OPTIONS } from "./stage-chip-config";

interface StageChipMenuProps {
  readonly stageName: string;
  readonly currentStatus: StageStatus;
  readonly position: { readonly top: number; readonly left: number };
  /** Lets the chip's outside-click handler treat the portal as inside. */
  readonly portalRef: RefObject<HTMLDivElement | null>;
  /**
   * Per-severity "click routes through risk creation" flags. True when the
   * bridge's raise interception would open the risk dialog instead of
   * applying the status (no sufficient covering risk); the option is labeled
   * with a "→ create risk" hint so the routing is announced, not a surprise.
   * Omitted on read-only / head paths.
   */
  readonly riskGap?: { readonly "at-risk": boolean; readonly blocked: boolean };
  readonly onApply: (next: StageStatus) => void;
}

/**
 * The stage chip's click-to-apply status menu, portaled to body to escape
 * accordion overflow:hidden. Each option is a single tap. Transitions that
 * need a second step (raise without a risk, lower a covered chip) are
 * intercepted by lead-form-sync-bridge, not here.
 */
export function StageChipMenu({
  stageName,
  currentStatus,
  position,
  portalRef,
  riskGap,
  onApply,
}: StageChipMenuProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={portalRef}
      className="fixed z-50 w-[180px] rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label={`Set status for ${stageName}`}
    >
      {STATUS_OPTIONS.map((opt) => {
        const cfg = STATUS_CONFIG[opt.value];
        const isCurrent = currentStatus === opt.value;
        const routesToRiskCreation =
          !isCurrent &&
          (opt.value === "at-risk" || opt.value === "blocked") &&
          riskGap?.[opt.value] === true;
        return (
          <button
            key={opt.value}
            type="button"
            role="menuitem"
            onClick={() => onApply(opt.value)}
            className="flex w-full max-md:min-h-[var(--touch-target-min)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
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
            <span className="flex-1">{opt.label.replace(/^[^\s]+\s/, "")}</span>
            {routesToRiskCreation && (
              <span className="text-[10px] text-[var(--color-muted-foreground)]">
                → create risk
              </span>
            )}
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
  );
}
