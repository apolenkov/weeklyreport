import {
  STATUS_BADGE as ITEM_STATUS_BADGE,
  type WeeklyProductStatus,
  type WeeklyReportItem,
} from "../../../report-sections";

export interface StatusConfig {
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
    avatarBg: CSS.success,
    avatarText: "var(--color-primary)",
  },
  "at-risk": {
    avatarBg: CSS.muted,
    avatarText: "var(--color-foreground)",
  },
  blocked: {
    avatarBg: CSS.statusBlockedBg,
    avatarText: CSS.destructive,
  },
  empty: {
    avatarBg: CSS.muted,
    avatarText: CSS.mutedForeground,
  },
} as const satisfies Record<WeeklyProductStatus, StatusConfig>;

// Stage, content and status stack on mobile; rank and rail span those rows.
export const ROW_GRID =
  "grid grid-cols-[20px_3px_minmax(0,1fr)] items-start gap-x-2 gap-y-1 [&>:nth-child(-n+2)]:row-span-3 [&>:nth-child(n+3)]:col-start-3 sm:grid-cols-[20px_3px_minmax(0,84px)_minmax(0,1fr)_auto] sm:gap-y-0 sm:[&>:nth-child(-n+2)]:row-span-1 sm:[&>:nth-child(n+3)]:col-start-auto md:grid-cols-[20px_3px_minmax(0,124px)_minmax(0,1fr)_104px] md:gap-x-3.5";

// The product-status dot in the header reads its hue from a named token
// (red=blocked alarm, amber=at-risk, green=on-track, muted=empty).
export const HEADER_STATUS_TONE = {
  "on-track": "var(--color-chip-on-track-text)",
  "at-risk": CSS.statusAtRiskFg,
  blocked: CSS.destructive,
  empty: CSS.mutedForeground,
} as const satisfies Record<WeeklyProductStatus, string>;

// Each workflow status resolves its badge through named tokens, never hardcoded
// hex: blocked=red alarm, at-risk=amber alarm, in-progress=steel-blue,
// completed=success green, planned/paused/postponed=muted.
export const STATUS_BADGE = {
  blocked: {
    label: ITEM_STATUS_BADGE.blocked.label,
    bg: CSS.statusBlockedBg,
    fg: CSS.destructive,
  },
  "at-risk": {
    label: ITEM_STATUS_BADGE["at-risk"].label,
    bg: "var(--color-status-at-risk-bg)",
    fg: CSS.statusAtRiskFg,
  },
  "in-progress": {
    label: ITEM_STATUS_BADGE["in-progress"].label,
    bg: "var(--color-status-in-progress-bg)",
    fg: "var(--color-status-in-progress-fg)",
  },
  completed: {
    label: ITEM_STATUS_BADGE.completed.label,
    bg: CSS.success,
    fg: "var(--color-success-foreground)",
  },
  planned: {
    label: ITEM_STATUS_BADGE.planned.label,
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  paused: {
    label: ITEM_STATUS_BADGE.paused.label,
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  postponed: {
    label: ITEM_STATUS_BADGE.postponed.label,
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
