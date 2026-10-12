import type { CanonicalStatus } from "@weeklyreport/shared";
import {
  AlertTriangle,
  CircleCheck,
  type LucideIcon,
  OctagonX,
  TriangleAlert,
} from "lucide-react";

// Centralize status presentation while leaving token values and the vocabulary
// owned by shared status semantics.
export type StatusLabelVariant = "screen" | "print" | "worstPill";
export type StatusIconVariant = "default" | "product";

interface StatusPresentation {
  readonly icons: Record<StatusIconVariant, LucideIcon | null>;
  readonly dotClassName: string;
  readonly toneClassName: string;
  readonly labels: Record<StatusLabelVariant, string>;
}

const STATUS_PRESENTATION: Record<CanonicalStatus, StatusPresentation> = {
  blocked: {
    icons: { default: AlertTriangle, product: OctagonX },
    dotClassName: "bg-[var(--color-destructive)]",
    // Blocked pills pair the stronger surface with destructive text so their
    // status remains legible at presentation scale.
    toneClassName:
      "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)] border-[var(--color-chip-blocked-border)]",
    labels: { screen: "Blocked", print: "Blocked", worstPill: "Blockers" },
  },
  "at-risk": {
    icons: { default: AlertTriangle, product: TriangleAlert },
    dotClassName: "bg-[var(--color-status-dot-at-risk)]",
    toneClassName:
      "bg-[var(--color-chip-at-risk-bg)] text-[var(--color-chip-at-risk-text)] border-[var(--color-chip-at-risk-border)]",
    labels: { screen: "At risk", print: "At Risk", worstPill: "At risk" },
  },
  "on-track": {
    icons: { default: null, product: CircleCheck },
    dotClassName: "bg-[var(--color-primary)]",
    toneClassName:
      "bg-[var(--color-chip-on-track-bg)] text-[var(--color-chip-on-track-text)] border-[var(--color-chip-on-track-border)]",
    labels: { screen: "On track", print: "On Track", worstPill: "On track" },
  },
  empty: {
    icons: { default: null, product: null },
    dotClassName: "bg-[var(--color-muted-foreground)] opacity-50",
    toneClassName:
      "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
    labels: { screen: "No status", print: "No status", worstPill: "No status" },
  },
};

export function statusLabel(
  status: CanonicalStatus,
  variant: StatusLabelVariant,
): string {
  return STATUS_PRESENTATION[status].labels[variant];
}

export function statusDotClassName(status: CanonicalStatus): string {
  return STATUS_PRESENTATION[status].dotClassName;
}

export function statusToneClassName(status: CanonicalStatus): string {
  return STATUS_PRESENTATION[status].toneClassName;
}

export function statusIcon(
  status: Exclude<CanonicalStatus, "empty">,
  variant: "product",
): LucideIcon;

export function statusIcon(status: CanonicalStatus): LucideIcon | null;

export function statusIcon(
  status: CanonicalStatus,
  variant: StatusIconVariant = "default",
): LucideIcon | null {
  return STATUS_PRESENTATION[status].icons[variant];
}
