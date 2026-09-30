import type { CSSProperties } from "react";

export interface StatusBadge {
  bg: string;
  text: string;
  label: string;
}

// The quiet not-in-flight states (planned / paused / postponed) share one
// muted pill treatment — only their label differs.
const MUTED_BADGE_BG = "var(--color-muted)";
const MUTED_BADGE_TEXT = "var(--color-muted-foreground)";

// Current-week wording for a planned item that was never begun.
export const NOT_STARTED_LABEL = "Not started";

export const STATUS_BADGE = {
  "in-progress": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "In progress",
  },
  completed: {
    bg: "var(--color-primary)",
    text: "var(--color-primary-foreground)",
    label: "Done",
  },
  blocked: {
    bg: "var(--color-status-blocked-bg)",
    text: "var(--color-destructive)",
    label: "Blocked",
  },
  // A DERIVED-only amber alarm (there is no stored at-risk item status) —
  // token-derived, not hardcoded hex.
  "at-risk": {
    bg: "var(--color-status-at-risk-bg)",
    text: "var(--color-status-at-risk-fg)",
    label: "At risk",
  },
  planned: {
    bg: MUTED_BADGE_BG,
    text: MUTED_BADGE_TEXT,
    label: "Planned",
  },
  paused: {
    bg: MUTED_BADGE_BG,
    text: MUTED_BADGE_TEXT,
    label: "Paused",
  },
  postponed: {
    bg: MUTED_BADGE_BG,
    text: MUTED_BADGE_TEXT,
    label: "Postponed",
  },
} as const satisfies Record<string, StatusBadge>;

// Uniform static-render height, sized to fit the chrome rows plus three clamped
// body lines. Rules: openspec/specs/lead-item-card-uniformity/spec.md.
const ITEM_CARD_REFERENCE_HEIGHT = 150;

export function cardContainerStyle(opts: {
  isPlanned: boolean;
  isBlocked: boolean;
}): CSSProperties {
  const { isPlanned, isBlocked } = opts;
  const borderStyle = isPlanned ? "dashed" : "solid";
  // Faint blocked border uses the destructive token at 20%.
  const borderColor = isBlocked
    ? "color-mix(in srgb, var(--color-destructive) 20%, transparent)"
    : "var(--color-muted)";
  return {
    height: ITEM_CARD_REFERENCE_HEIGHT,
    borderTop: `1px ${borderStyle} ${borderColor}`,
    borderRight: `1px ${borderStyle} ${borderColor}`,
    borderBottom: `1px ${borderStyle} ${borderColor}`,
    borderLeft: isPlanned
      ? `3px dashed var(--color-starbucks-accent)`
      : `3px solid ${isBlocked ? "var(--color-destructive)" : "var(--color-starbucks-accent)"}`,
    background: isBlocked
      ? "var(--color-status-blocked-bg)"
      : "var(--color-background)",
  };
}
