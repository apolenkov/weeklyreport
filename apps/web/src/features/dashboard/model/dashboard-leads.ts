import type {
  ActivityLiveResponse,
  ActivityLiveRow,
  PortfolioProductOverview,
  ReportSectionReadModel,
  SectionReviewView,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import {
  initialsFromName as sharedInitialsFromName,
  MS_PER_DAY,
  shortNameFromName,
} from "@customreport/shared";

import type { LeadStatus } from "../../report-sections";
import { deriveLeadStatus, trafficToStageStatus } from "../../report-sections";
import type { LeadInfo, ProductStatus, TrafficLight } from "./dashboard";
import {
  countActivityLiveContent,
  countActivityRecords,
  countProductContent,
  countSectionContent,
  productColumnCounts,
} from "./dashboard-counts";
import {
  attentionLabel,
  reviewPresentation,
} from "./dashboard-lead-presentation";
import { compareLeadPriority, queuePriority } from "./dashboard-lead-priority";
import { buildDashboardLeadRows } from "./dashboard-lead-rows";

const TRAFFIC_ICON: Record<ProductStatus, string> = {
  "on-track": "✓",
  blocked: "✕",
  "at-risk": "!",
};

const ISO_DATE_LENGTH = 10;

interface BuildLeadInfosArgs {
  readonly review?: readonly SubmissionDashboardRow[];
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse;
  readonly now: Date;
  readonly currentUserId?: string;
}

interface LeadBuildContext {
  readonly weeklyReport: WeeklyReportReadModel;
  readonly sectionByAuthor: ReadonlyMap<string, ReportSectionReadModel>;
  readonly activityByLead: ReadonlyMap<string, ActivityLiveRow>;
  readonly now: Date;
  readonly currentUserId?: string;
}

interface LeadQueueState {
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

function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
}

function trafficLightsForLead(
  leadName: string,
  portfolio: readonly PortfolioProductOverview[],
): TrafficLight[] {
  return portfolio
    .filter((product) => product.leadNames.includes(leadName))
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

function deriveLeadQueueState(
  row: SubmissionDashboardRow,
  context: LeadBuildContext,
): LeadQueueState {
  const section = context.sectionByAuthor.get(row.leadId);
  const activity = context.activityByLead.get(row.leadId);
  const contentCount = Math.max(
    section ? countSectionContent(section) : 0,
    countActivityLiveContent(activity),
  );
  const status = deriveLeadStatus({
    sectionStatus: section?.status ?? activity?.status ?? row.status,
    contentCount,
  });
  const reviews = section?.reviews ?? [];
  const review = reviewPresentation(reviews);
  const editable =
    context.weeklyReport.periodStatus === "open" ||
    context.weeklyReport.periodStatus === "reopened";
  const lastEditAt = activity?.lastEditAt ?? null;
  const isStale =
    editable &&
    status !== "submitted" &&
    (lastEditAt === null ||
      context.now.getTime() - lastEditAt.getTime() > MS_PER_DAY);
  const reviewer = Boolean(section?.canReview);
  const canReview =
    editable &&
    status === "submitted" &&
    reviewer &&
    review.reviewState !== "approved";

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
    isStale,
    reviewer,
    canReview,
    trafficLights: trafficLightsForLead(
      row.leadName,
      context.weeklyReport.portfolioOverview,
    ),
  };
}

function sectionIdentity(
  section: ReportSectionReadModel | undefined,
  activity: ActivityLiveRow | undefined,
): Partial<Pick<LeadInfo, "reportSectionId" | "version">> {
  const reportSectionId = section?.reportSectionId ?? activity?.reportSectionId;
  return {
    ...(reportSectionId ? { reportSectionId } : {}),
    ...(section ? { version: section.version } : {}),
  };
}

function leadActions(state: LeadQueueState): LeadInfo["actions"] {
  return {
    canOpen: state.contentCount > 0,
    canRemind:
      state.editable && state.status !== "submitted" && state.remindersEnabled,
    canReview: state.canReview,
    canRequestChanges:
      state.editable && state.status === "submitted" && state.reviewer,
    canRevoke:
      state.editable &&
      state.status === "submitted" &&
      state.section !== undefined,
  };
}

function buildLeadInfo(
  row: SubmissionDashboardRow,
  context: LeadBuildContext,
): LeadInfo {
  const state = deriveLeadQueueState(row, context);

  return {
    id: row.leadId,
    initials: initialsFromName(row.leadName),
    name: shortNameFromName(row.leadName),
    role: row.role,
    status: state.status,
    trafficLights: [...state.trafficLights],
    lastEditAt: state.lastEditAt,
    submittedAt:
      state.activity?.submittedAt ??
      state.section?.submittedAt ??
      row.submittedAt,
    isStale: state.isStale,
    isCurrentUser: context.currentUserId === row.leadId,
    productCount: row.projectNames.length,
    reportContentCount: state.section ? countProductContent(state.section) : 0,
    ...productColumnCounts(state.section),
    activityCount: state.section ? countActivityRecords(state.section) : 0,
    submittedAtLabel:
      state.section?.submittedAt?.toISOString().slice(0, ISO_DATE_LENGTH) ??
      null,
    ...sectionIdentity(state.section, state.activity),
    reviews: state.reviews,
    ...state.review,
    attentionLabel: attentionLabel(state.trafficLights),
    actions: leadActions(state),
    priority: queuePriority(
      state.review.reviewState,
      state.canReview,
      state.isStale,
      state.status,
    ),
  };
}

export function buildLeadInfos({
  review,
  weeklyReport,
  activity,
  now,
  currentUserId,
}: BuildLeadInfosArgs): LeadInfo[] {
  const context: LeadBuildContext = {
    weeklyReport,
    sectionByAuthor: new Map(
      weeklyReport.leadSections.map((section) => [section.authorId, section]),
    ),
    activityByLead: new Map(
      (activity?.rows ?? []).map((row) => [row.leadId, row]),
    ),
    now,
    ...(currentUserId ? { currentUserId } : {}),
  };
  const leads = buildDashboardLeadRows({
    review,
    weeklyReport,
    activity,
  }).map((row) => buildLeadInfo(row, context));
  return leads.toSorted(compareLeadPriority);
}

export type PrimaryAction = "open" | "remind" | "review" | "none";

// The queue's action precedence ladder: review beats open beats remind.
export function primaryAction(lead: LeadInfo): PrimaryAction {
  if (lead.actions.canReview) return "review";
  if (lead.actions.canOpen) return "open";
  if (lead.actions.canRemind) return "remind";
  return "none";
}
