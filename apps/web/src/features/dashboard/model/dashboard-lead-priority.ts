import type { LeadStatus } from "../../report-sections";
import type { LeadInfo } from "./dashboard";

const QUEUE_PRIORITY_ORDER: readonly LeadInfo["priority"][] = [
  "action-needed",
  "stale",
  "active",
  "complete",
];

/**
 * Queue Priority.
 * @param reviewState - The reviewState argument.
 * @param canReview - The canReview argument.
 * @param isStale - The isStale argument.
 * @param status - The status argument.
 */
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

/**
 * Compare Lead Priority.
 * @param left - The left argument.
 * @param right - The right argument.
 */
export function compareLeadPriority(left: LeadInfo, right: LeadInfo): number {
  const priorityDifference =
    QUEUE_PRIORITY_ORDER.indexOf(left.priority) -
    QUEUE_PRIORITY_ORDER.indexOf(right.priority);
  return priorityDifference || left.name.localeCompare(right.name, "en");
}
