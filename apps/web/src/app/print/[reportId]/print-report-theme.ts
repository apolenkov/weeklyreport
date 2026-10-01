import type { CanonicalStatus } from "@customreport/shared";

// Print palette roles — named semantics, not raw hues, so one ink/contrast
// contract owns every PDF surface.
export const BORDER_LIGHT = "1px solid #e5e7eb";
export const TEXT_SECONDARY = "rgba(0,0,0,0.58)";
export const TEXT_PRIMARY = "rgba(0,0,0,0.87)";
export const TEXT_TERTIARY = "rgba(0,0,0,0.5)";
// Dark brand surface: portfolio header bar + avatar chip fill.
export const BRAND_DARK_SURFACE = "#1E3932";
// Text on the brand dark surface.
export const ON_BRAND_TEXT = "#ffffff";
// Needs-attention / at-risk callout wash.
export const ATTENTION_BG = "#fef9e7";
// Decision accent (summary card + decision badge).
export const DECISION_ACCENT = "#3730a3";

const PRINT_STATUS_COLOR = {
  "on-track": "#006241",
  "at-risk": "#daa520",
  blocked: "#c82014",
  empty: "#6b7280",
} as const satisfies Record<CanonicalStatus, string>;

export function printStatusColor(status: CanonicalStatus): string {
  return PRINT_STATUS_COLOR[status];
}
