import { STATUS_BADGE } from "../../../features/report-sections/model/item-card-style";

export const BORDER_LIGHT = "1px solid #e5e7eb";
export const TEXT_SECONDARY = "rgba(0,0,0,0.58)";
export const TEXT_PRIMARY = "rgba(0,0,0,0.87)";

/**
 * Print Status Color.
 * @param status - The status argument.
 */
export function printStatusColor(status: string): string {
  switch (status) {
    case "on-track":
      return "#006241";
    case "at-risk":
      return "#daa520";
    case "blocked":
      return "#c82014";
    default:
      return "#6b7280";
  }
}

/**
 * Workflow Badge.
 * @param status - The status argument.
 */
export function workflowBadge(status: keyof typeof STATUS_BADGE): string {
  return STATUS_BADGE[status].label;
}
