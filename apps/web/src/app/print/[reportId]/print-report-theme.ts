import type { CanonicalStatus } from "@customreport/shared";

export const BORDER_LIGHT = "1px solid #e5e7eb";
export const TEXT_SECONDARY = "rgba(0,0,0,0.58)";
export const TEXT_PRIMARY = "rgba(0,0,0,0.87)";

const PRINT_STATUS_COLOR = {
  "on-track": "#006241",
  "at-risk": "#daa520",
  blocked: "#c82014",
  empty: "#6b7280",
} as const satisfies Record<CanonicalStatus, string>;

export function printStatusColor(status: CanonicalStatus): string {
  return PRINT_STATUS_COLOR[status];
}
