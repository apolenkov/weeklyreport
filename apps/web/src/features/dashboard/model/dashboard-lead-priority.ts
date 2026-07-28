import type { LeadStatus } from "../../report-sections";
import type {
  LeadPriority,
  ReviewPresentation,
} from "./dashboard-lead-presentation";

interface PrioritizedLead {
  readonly priority: LeadPriority;
  readonly name: string;
}

const QUEUE_PRIORITY_ORDER: readonly LeadPriority[] = [
  "action-needed",
  "stale",
  "active",
  "complete",
];

export function queuePriority(
  reviewState: ReviewPresentation["reviewState"],
  canReview: boolean,
  isStale: boolean,
  status: LeadStatus,
): LeadPriority {
  if (reviewState === "changes-requested" || canReview) return "action-needed";
  if (isStale) return "stale";
  return status === "submitted" ? "complete" : "active";
}

export function compareLeadPriority(
  left: PrioritizedLead,
  right: PrioritizedLead,
): number {
  const priorityDifference =
    QUEUE_PRIORITY_ORDER.indexOf(left.priority) -
    QUEUE_PRIORITY_ORDER.indexOf(right.priority);
  return priorityDifference || left.name.localeCompare(right.name, "en");
}
