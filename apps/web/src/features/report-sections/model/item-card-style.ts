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
  // record-status-derived-from-risk: a DERIVED-only amber alarm (there is no
  // stored at-risk item status) — token-derived per status-color-semantics.
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

/**
 * Fixed card height for the static render, matching the section-level
 * empty-state placeholder ("No items yet" in current-week-section.tsx /
 * next-week-section.tsx) so every card in a column is uniform (B1). The height
 * is sized to the CONTENT, not the empty placeholder: it fits the status-pill /
 * action row + three body lines (the `line-clamp-3` the body keeps) + the
 * author / stage-tag footer + padding. A short card fills the slack with
 * whitespace; a long one truncates at three lines with an ellipsis (its full
 * text stays available via the `title` hover tooltip). The chrome rows keep
 * their natural size (`shrink-0`); the body is the only flexible slot.
 */
export const ITEM_CARD_REFERENCE_HEIGHT = 150;

/** Faded opacity applied to a card/row owned by another lead ("foreign"). */
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
