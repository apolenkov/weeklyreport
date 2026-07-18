export const BORDER_LIGHT = "1px solid #e5e7eb";
export const TEXT_SECONDARY = "rgba(0,0,0,0.58)";
export const TEXT_PRIMARY = "rgba(0,0,0,0.87)";

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

export function workflowBadge(status: string): string {
  switch (status) {
    case "completed":
      return "Done";
    case "in-progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "planned":
      return "Planned";
    case "paused":
      return "Paused";
    case "postponed":
      return "Postponed";
    default:
      return status;
  }
}
