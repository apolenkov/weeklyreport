import type {
  WeeklyProductStatus,
  WeeklyReportItem,
} from "../../../report-sections";

export interface StatusConfig {
  bg: string;
  text: string;
  avatarBg: string;
  avatarText: string;
}

export const CSS = {
  success: "var(--color-success)",
  muted: "var(--color-muted)",
  statusBlockedBg: "var(--color-status-blocked-bg)",
  destructive: "var(--color-destructive)",
  statusAtRiskBorder: "var(--color-status-at-risk-border)",
  statusAtRiskFg: "var(--color-status-at-risk-fg)",
  mutedForeground: "var(--color-muted-foreground)",
} as const;

// Red is the only alarm hue (blocked); at-risk goes neutral here — the amber
// signal lives on the row's left stripe, not on a flooded amber fill. No
// hardcoded status hex.
export const STATUS_CONFIG = {
  "on-track": {
    bg: CSS.success,
    text: "var(--color-primary)",
    avatarBg: CSS.success,
    avatarText: "var(--color-primary)",
  },
  "at-risk": {
    bg: CSS.muted,
    text: "var(--color-foreground)",
    avatarBg: CSS.muted,
    avatarText: "var(--color-foreground)",
  },
  blocked: {
    bg: CSS.statusBlockedBg,
    text: CSS.destructive,
    avatarBg: CSS.statusBlockedBg,
    avatarText: CSS.destructive,
  },
  empty: {
    bg: CSS.muted,
    text: CSS.mutedForeground,
    avatarBg: CSS.muted,
    avatarText: CSS.mutedForeground,
  },
} as const satisfies Record<WeeklyProductStatus, StatusConfig>;

// One shared grid so stage labels and content keep a common left edge.
export const ROW_GRID =
  "grid grid-cols-[20px_3px_minmax(0,84px)_minmax(0,1fr)_auto] items-start gap-x-2 md:grid-cols-[20px_3px_minmax(0,124px)_minmax(0,1fr)_104px] md:gap-x-3.5";

// The product-status dot in the header reads its hue from a named token
// (red=blocked alarm, amber=at-risk, green=on-track, muted=empty).
export const HEADER_STATUS_TONE = {
  "on-track": "var(--color-chip-on-track-text)",
  "at-risk": CSS.statusAtRiskBorder,
  blocked: CSS.destructive,
  empty: CSS.mutedForeground,
} as const satisfies Record<WeeklyProductStatus, string>;

// status-color-semantics: each workflow status resolves its badge through named
// tokens — never hardcoded hex. blocked=red alarm, in-progress=steel-blue (the
// added token), completed=success green, planned=muted.
export const STATUS_BADGE = {
  blocked: {
    label: "Blocked",
    bg: CSS.statusBlockedBg,
    fg: CSS.destructive,
  },
  "in-progress": {
    label: "In Progress",
    bg: "var(--color-status-in-progress-bg)",
    fg: "var(--color-status-in-progress-fg)",
  },
  completed: {
    label: "Done",
    bg: CSS.success,
    fg: "var(--color-success-foreground)",
  },
  planned: {
    label: "Planned",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  paused: {
    label: "Paused",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  postponed: {
    label: "Postponed",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
} as const satisfies Record<string, { label: string; bg: string; fg: string }>;

// Item row left-stripe: red only for blocked (the alarm hue); every other status
// is carried by the right-side badge, so the rail stays a neutral spine.
export function itemRailTone(status: string): string {
  return status === "blocked" ? CSS.destructive : "var(--color-border)";
}

export const SECTION_DIVIDER =
  "border-t border-[var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0";

// Lets the expand animation start before the smooth scroll kicks in.
export const SCROLL_INTO_VIEW_DELAY_MS = 80;

export type StatusBadgeStatus = WeeklyReportItem["status"];
