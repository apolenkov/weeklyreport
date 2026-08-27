import type {
  ActivityLiveRow,
  PortfolioProductOverview,
  ReportSectionReadModel,
  SectionReviewView,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { MS_PER_DAY } from "@customreport/shared";

import type { LeadStatus } from "../../report-sections";
import { deriveLeadStatus, trafficToStageStatus } from "../../report-sections";
import {
  countActivityLiveContent,
  countSectionContent,
} from "./dashboard-counts";
import {
  type LeadInfo,
  type ProductStatus,
  reviewPresentation,
  type TrafficLight,
} from "./dashboard-lead-presentation";

const TRAFFIC_ICON: Record<ProductStatus, string> = {
  "on-track": "✓",
  blocked: "✕",
  "at-risk": "!",
};

export interface LeadBuildContext {
  readonly weeklyReport: WeeklyReportReadModel;
  readonly sectionByAuthor: ReadonlyMap<string, ReportSectionReadModel>;
  readonly activityByLead: ReadonlyMap<string, ActivityLiveRow>;
  readonly now: Date;
  readonly currentUserId?: string | undefined;
}

export interface LeadQueueState {
  readonly section: ReportSectionReadModel | undefined;
  readonly activity: ActivityLiveRow | undefined;
  readonly contentCount: number;
  readonly status: LeadStatus;
  readonly reviews: readonly SectionReviewView[];
  readonly review: Pick<LeadInfo, "reviewState" | "reviewLabel">;
  readonly editable: boolean;
  readonly remindersEnabled: boolean;
  readonly lastEditAt: Date | null;
  readonly isStale: boolean;
  readonly reviewer: boolean;
  readonly canReview: boolean;
  readonly trafficLights: readonly TrafficLight[];
}

function trafficLightsForLead(
  leadId: string,
  portfolio: readonly PortfolioProductOverview[],
): readonly TrafficLight[] {
  return portfolio
    .filter((product) => product.leadIds.includes(leadId))
    .map((product) => product.worstStatus)
    .filter((status): status is NonNullable<typeof status> => status !== null)
    .map((status) => {
      const presentation = trafficToStageStatus(status);
      const normalized: ProductStatus =
        presentation === "blocked" || presentation === "at-risk"
          ? presentation
          : "on-track";
      return { status: normalized, icon: TRAFFIC_ICON[normalized] };
    });
}

function leadContentCount(
  section: ReportSectionReadModel | undefined,
  activity: ActivityLiveRow | undefined,
): number {
  return Math.max(
    section ? countSectionContent(section) : 0,
    countActivityLiveContent(activity),
  );
}

function leadStatus(
  row: SubmissionDashboardRow,
  section: ReportSectionReadModel | undefined,
  activity: ActivityLiveRow | undefined,
  contentCount: number,
): LeadStatus {
  return deriveLeadStatus({
    sectionStatus: section?.status ?? activity?.status ?? row.status,
    contentCount,
  });
}

function leadIsStale(
  editable: boolean,
  status: LeadStatus,
  lastEditAt: Date | null,
  now: Date,
): boolean {
  if (!editable || status === "submitted") return false;
  return (
    lastEditAt === null || now.getTime() - lastEditAt.getTime() > MS_PER_DAY
  );
}

function leadCanReview(
  editable: boolean,
  status: LeadStatus,
  reviewer: boolean,
  reviewState: LeadInfo["reviewState"],
): boolean {
  return (
    editable && status === "submitted" && reviewer && reviewState !== "approved"
  );
}

export function deriveLeadQueueState(
  row: SubmissionDashboardRow,
  context: LeadBuildContext,
): LeadQueueState {
  const section = context.sectionByAuthor.get(row.leadId);
  const activity = context.activityByLead.get(row.leadId);
  const contentCount = leadContentCount(section, activity);
  const status = leadStatus(row, section, activity, contentCount);
  const reviews = section?.reviews ?? [];
  const review = reviewPresentation(reviews);
  const editable = ["open", "reopened"].includes(
    context.weeklyReport.periodStatus,
  );
  const lastEditAt = activity?.lastEditAt ?? null;
  const reviewer = Boolean(section?.canReview);

  return {
    section,
    activity,
    contentCount,
    status,
    reviews,
    review,
    editable,
    remindersEnabled: context.weeklyReport.hasActiveReminderRule,
    lastEditAt,
    isStale: leadIsStale(editable, status, lastEditAt, context.now),
    reviewer,
    canReview: leadCanReview(editable, status, reviewer, review.reviewState),
    trafficLights: trafficLightsForLead(
      row.leadId,
      context.weeklyReport.portfolioOverview,
    ),
  };
}
