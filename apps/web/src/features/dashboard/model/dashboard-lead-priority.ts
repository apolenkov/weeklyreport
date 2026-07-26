import type { LeadStatus } from "../../report-sections";
import type { LeadInfo } from "./dashboard";

const QUEUE_PRIORITY_ORDER: readonly LeadInfo["priority"][] = [
  "action-needed",
  "stale",
  "active",
  "complete",
];

export function queuePriority(
  reviewState: LeadInfo["reviewState"],
  canReview: boolean,
  isStale: boolean,
  status: LeadStatus,
): LeadInfo["priority"] {
  if (reviewState === "changes-requested" || canReview) return "action-needed";
  if (isStale) return "stale";
  return status === "submitted" ? "complete" : "active";
}

export function compareLeadPriority(left: LeadInfo, right: LeadInfo): number {
  const priorityDifference =
    QUEUE_PRIORITY_ORDER.indexOf(left.priority) -
    QUEUE_PRIORITY_ORDER.indexOf(right.priority);
  return priorityDifference || left.name.localeCompare(right.name, "en");
}
