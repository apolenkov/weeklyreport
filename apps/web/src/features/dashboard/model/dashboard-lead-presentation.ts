import type { DbRole, SectionReviewView } from "@customreport/shared";

import type { LeadStatus } from "../../report-sections";

export type ProductStatus = "on-track" | "at-risk" | "blocked";

export interface TrafficLight {
  status: ProductStatus;
  icon: string;
}

export interface ReviewPresentation {
  reviewState: "changes-requested" | "approved" | "awaiting" | "none";
  reviewLabel: string;
}

export type AttentionLabel = "Blocked" | "At risk" | "On track" | "No signal";

export type LeadPriority = "action-needed" | "stale" | "active" | "complete";

export interface LeadInfo extends ReviewPresentation {
  id: string;
  initials: string;
  name: string;
  role: DbRole;
  status: LeadStatus;
  trafficLights: TrafficLight[];
  lastEditAt: Date | null;
  submittedAt: Date | null;
  isStale: boolean;
  isCurrentUser: boolean;
  productCount?: number;
  reportContentCount?: number;
  currentItemCount?: number;
  nextItemCount?: number;
  riskCount?: number;
  decisionCount?: number;
  priorityCount?: number;
  /** Count of activity-parented records (work units). */
  activityCount?: number;
  submittedAtLabel?: string | null;
  /** The section UUID needed for the per-lead Revoke button. */
  reportSectionId?: string;
  version?: number;
  reviews: readonly SectionReviewView[];
  attentionLabel: AttentionLabel;
  actions: {
    readonly canOpen: boolean;
    readonly canRemind: boolean;
    readonly canReview: boolean;
    readonly canRequestChanges: boolean;
    readonly canRevoke: boolean;
  };
  priority: LeadPriority;
}

export function reviewPresentation(
  reviews: readonly SectionReviewView[],
): ReviewPresentation {
  const current = reviews.filter((review) => review.isCurrent);
  if (current.some((review) => review.verdict === "changes_requested")) {
    return {
      reviewState: "changes-requested",
      reviewLabel: "Changes requested",
    };
  }
  if (current.some((review) => review.verdict === "approved")) {
    return { reviewState: "approved", reviewLabel: "Approved" };
  }
  return reviews.length > 0
    ? { reviewState: "awaiting", reviewLabel: "Awaiting review" }
    : { reviewState: "none", reviewLabel: "Not reviewed" };
}

export function attentionLabel(
  trafficLights: readonly TrafficLight[],
): AttentionLabel {
  if (trafficLights.some((light) => light.status === "blocked"))
    return "Blocked";
  if (trafficLights.some((light) => light.status === "at-risk"))
    return "At risk";
  if (trafficLights.some((light) => light.status === "on-track"))
    return "On track";
  return "No signal";
}
