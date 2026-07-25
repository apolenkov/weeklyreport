import type { CanonicalStatus, TrafficLightStatus } from "@customreport/shared";
import {
  canonicalToTrafficLight,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@customreport/shared";
import { AlertTriangle, type LucideIcon } from "lucide-react";

/**
 * Single source for a workflow status's icon, dot, tone chip, and labels, so
 * slide/dashboard/print surfaces derive them here instead of each holding its
 * own `Record<status, …>`. Color VALUES stay owned by status-color-semantics /
 * the status tokens — this map only keys onto those tokens. The status
 * vocabulary itself (`CanonicalStatus`) lives in `@customreport/shared`.
 */

/**
 * Label vocabularies the surfaces render today, reproduced (not unified) so
 * output stays byte-identical: `screen` sentence-case (pill/chip sr-only text),
 * `print` Title-case (weekly report + dashboard badge), `worstPill` the slide
 * header pill wording (`Blockers` for blocked).
 */
export type StatusLabelVariant = "screen" | "print" | "worstPill";

interface StatusPresentation {
  /** Alert glyph on the worst-status pill; null when the status carries none. */
  readonly icon: LucideIcon | null;
  /** Status-dot background class (empty is the muted, half-opacity dot). */
  readonly dotClassName: string;
  /** Worst-status chip tone: bg / text / border classes. */
  readonly toneClassName: string;
  readonly labels: Record<StatusLabelVariant, string>;
}

const STATUS_PRESENTATION: Record<CanonicalStatus, StatusPresentation> = {
  blocked: {
    icon: AlertTriangle,
    dotClassName: "bg-[var(--color-destructive)]",
    // The pill text is destructive, not --color-chip-blocked-text: reproduced
    // verbatim from the header pill it replaces.
    toneClassName:
      "bg-[var(--color-chip-blocked-bg)] text-[var(--color-destructive)] border-[var(--color-chip-blocked-border)]",
    labels: { screen: "Blocked", print: "Blocked", worstPill: "Blockers" },
  },
  "at-risk": {
    icon: AlertTriangle,
    dotClassName: "bg-[var(--color-status-dot-at-risk)]",
    toneClassName:
      "bg-[var(--color-chip-at-risk-bg)] text-[var(--color-chip-at-risk-text)] border-[var(--color-chip-at-risk-border)]",
    labels: { screen: "At risk", print: "At Risk", worstPill: "At risk" },
  },
  "on-track": {
    icon: null,
    dotClassName: "bg-[var(--color-primary)]",
    toneClassName:
      "bg-[var(--color-chip-on-track-bg)] text-[var(--color-chip-on-track-text)] border-[var(--color-chip-on-track-border)]",
    labels: { screen: "On track", print: "On Track", worstPill: "On track" },
  },
  empty: {
    icon: null,
    dotClassName: "bg-[var(--color-muted-foreground)] opacity-50",
    toneClassName:
      "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
    labels: { screen: "No status", print: "No status", worstPill: "No status" },
  },
};

/**
 * Worst traffic light across a set of values — a thin adapter over the shared
 * canonical fold, so this module keeps no private precedence table. An
 * all-null (or empty) input folds to `"empty"` and adapts back to `null`.
 * @param statuses - The statuses argument.
 */
export function worstTrafficStatus(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return canonicalToTrafficLight(
    worstCanonicalStatus(statuses.map(trafficLightToCanonical)),
  );
}

/**
 * Status Label.
 * @param status - The status argument.
 * @param variant - The variant argument.
 */
export function statusLabel(
  status: CanonicalStatus,
  variant: StatusLabelVariant,
): string {
  return STATUS_PRESENTATION[status].labels[variant];
}

/**
 * Status Dot Class Name.
 * @param status - The status argument.
 */
export function statusDotClassName(status: CanonicalStatus): string {
  return STATUS_PRESENTATION[status].dotClassName;
}

/**
 * Status Tone Class Name.
 * @param status - The status argument.
 */
export function statusToneClassName(status: CanonicalStatus): string {
  return STATUS_PRESENTATION[status].toneClassName;
}

/**
 * Status Icon.
 * @param status - The status argument.
 */
export function statusIcon(status: CanonicalStatus): LucideIcon | null {
  return STATUS_PRESENTATION[status].icon;
}
