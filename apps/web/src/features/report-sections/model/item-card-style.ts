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

export const STATUS_BADGE = {
  "in-progress": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "In Progress",
  },
  completed: {
    bg: "var(--color-primary)",
    text: "var(--color-primary-foreground)",
    label: "Completed",
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
    label: "At Risk",
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

// Foreign rows use reduced opacity to distinguish ownership without hiding data.
export const FOREIGN_ENTRY_OPACITY = 0.7;

export function cardContainerStyle(opts: {
  isPlanned: boolean;
  isBlocked: boolean;
  foreign: boolean;
  isEditing: boolean;
}): CSSProperties {
  const { isPlanned, isBlocked, foreign, isEditing } = opts;
  const borderStyle = isPlanned ? "dashed" : "solid";
  // Faint blocked border = the destructive token at 20% (token-derived, no
  // hardcoded status literal — status-color-semantics).
  const borderColor = isBlocked
    ? "color-mix(in srgb, var(--color-destructive) 20%, transparent)"
    : "var(--color-muted)";
  return {
    // The reference height is fixed for the static render; inline edit
    // relaxes it to a floor so the textarea can grow past it to show the
    // full untruncated text (never clipped while editing).
    ...(isEditing
      ? { minHeight: ITEM_CARD_REFERENCE_HEIGHT }
      : { height: ITEM_CARD_REFERENCE_HEIGHT }),
    borderTop: `1px ${borderStyle} ${borderColor}`,
    borderRight: `1px ${borderStyle} ${borderColor}`,
    borderBottom: `1px ${borderStyle} ${borderColor}`,
    borderLeft: isPlanned
      ? `3px dashed var(--color-starbucks-accent)`
      : `3px solid ${isBlocked ? "var(--color-destructive)" : "var(--color-starbucks-accent)"}`,
    background: isBlocked
      ? "var(--color-status-blocked-bg)"
      : "var(--color-background)",
    opacity: foreign ? FOREIGN_ENTRY_OPACITY : 1,
  };
}
