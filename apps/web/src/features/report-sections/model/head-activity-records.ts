import type {
  CanonicalStatus,
  ReportSectionReadModel,
  SectionActivity,
} from "@weeklyreport/shared";
import { trafficLightToCanonical } from "@weeklyreport/shared";

import { activityDisplayTitle } from "../../../shared/lib/activity/activity-display";

export type ActivitySectionSlice = Pick<
  ReportSectionReadModel,
  | "reportSectionId"
  | "authorId"
  | "authorName"
  | "activities"
  | "items"
  | "risks"
  | "decisions"
  | "canReview"
>;

export interface HeadActivityRecords {
  readonly key: string;
  readonly reportSectionId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly canReview: boolean;
  readonly activityName: string;
  readonly tone: CanonicalStatus | null;
  readonly note: string | null;
  readonly linkedProducts: readonly string[];
  readonly currentItems: ReportSectionReadModel["items"];
  readonly nextItems: ReportSectionReadModel["items"];
  readonly risks: ReportSectionReadModel["risks"];
  readonly decisions: ReportSectionReadModel["decisions"];
}

function activityRecords(
  section: ActivitySectionSlice,
  activity: SectionActivity | null,
): HeadActivityRecords {
  const knownIds = new Set(section.activities.map((row) => row.activityId));
  const owns = (id: string | null | undefined) =>
    activity ? id === activity.activityId : id != null && !knownIds.has(id);
  const items = section.items.filter((item) => owns(item.activityId));
  return {
    key: `${section.reportSectionId}::${activity?.activityId ?? "unavailable"}`,
    reportSectionId: section.reportSectionId,
    authorId: section.authorId,
    authorName: section.authorName,
    canReview: section.canReview ?? false,
    activityName: activity
      ? activityDisplayTitle(activity)
      : "Activity details unavailable",
    tone: activity
      ? trafficLightToCanonical(activity.derivedStatus ?? activity.status)
      : null,
    note: activity
      ? (activity.note ?? null)
      : "These saved records no longer have activity details in this section.",
    linkedProducts:
      activity?.linkedProducts.map((product) => product.productName) ?? [],
    currentItems: items.filter((item) => item.type === "current"),
    nextItems: items.filter((item) => item.type === "next"),
    risks: section.risks.filter((risk) => owns(risk.activityId)),
    decisions: section.decisions.filter((decision) =>
      owns(decision.activityId),
    ),
  };
}

export function buildHeadActivityRecords(
  sections: readonly ActivitySectionSlice[],
): HeadActivityRecords[] {
  return sections
    .flatMap((section) => {
      const available = section.activities.map((activity) =>
        activityRecords(section, activity),
      );
      const unavailable = activityRecords(section, null);
      return unavailable.currentItems.length +
        unavailable.nextItems.length +
        unavailable.risks.length +
        unavailable.decisions.length >
        0
        ? [...available, unavailable]
        : available;
    })
    .toSorted(
      (left, right) =>
        left.activityName.localeCompare(right.activityName, "ru") ||
        left.authorName.localeCompare(right.authorName, "ru"),
    );
}
