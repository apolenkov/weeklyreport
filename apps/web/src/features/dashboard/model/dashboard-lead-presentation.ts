import type { DbRole, SectionReviewView } from "@weeklyreport/shared";

import type { LeadStatus } from "../../report-sections";

export type ProductStatus = "on-track" | "at-risk" | "blocked";

export interface TrafficLight {
  readonly status: ProductStatus;
  readonly icon: string;
}

export interface ReviewPresentation {
  readonly reviewState: "changes-requested" | "approved" | "awaiting" | "none";
  readonly reviewLabel: string;
}

export type AttentionLabel = "Blocked" | "At risk" | "On track" | "No signal";

export type LeadPriority = "action-needed" | "stale" | "active" | "complete";

export interface LeadInfo extends ReviewPresentation {
  readonly id: string;
  readonly initials: string;
  readonly name: string;
  readonly role: DbRole;
  readonly status: LeadStatus;
  readonly trafficLights: readonly TrafficLight[];
  readonly lastEditAt: Date | null;
  readonly submittedAt: Date | null;
  readonly isStale: boolean;
  readonly isCurrentUser: boolean;
  readonly productCount?: number;
  readonly reportContentCount?: number;
  readonly currentItemCount?: number;
  readonly nextItemCount?: number;
  readonly riskCount?: number;
  readonly decisionCount?: number;
  readonly priorityCount?: number;
  readonly activityCount?: number;
  readonly submittedAtLabel?: string | null;
  // Needed by the per-lead Revoke button.
  readonly reportSectionId?: string;
  readonly version?: number;
  readonly reviews: readonly SectionReviewView[];
  readonly attentionLabel: AttentionLabel;
  readonly reminderRuleId: string | null;
  readonly actions: {
    readonly canOpen: boolean;
    readonly canRemind: boolean;
    readonly canReview: boolean;
    readonly canRequestChanges: boolean;
    readonly canRevoke: boolean;
  };
  readonly priority: LeadPriority;
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
