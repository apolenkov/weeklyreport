import type { SectionReviewView } from "@customreport/shared";

import type { LeadInfo, TrafficLight } from "./dashboard";

export function reviewPresentation(
  reviews: readonly SectionReviewView[],
): Pick<LeadInfo, "reviewState" | "reviewLabel"> {
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
): LeadInfo["attentionLabel"] {
  if (trafficLights.some((light) => light.status === "blocked"))
    return "Blocked";
  if (trafficLights.some((light) => light.status === "at-risk"))
    return "At risk";
  if (trafficLights.some((light) => light.status === "on-track"))
    return "On track";
  return "No signal";
}
