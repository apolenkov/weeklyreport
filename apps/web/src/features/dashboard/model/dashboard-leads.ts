import type {
  ActivityLiveResponse,
  ActivityLiveRow,
  ReportSectionReadModel,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";
import { initialsFromName } from "../../../shared/lib/format/user-initials";
import {
  countActivityRecords,
  countProductContent,
  productColumnCounts,
} from "./dashboard-counts";
import { attentionLabel, type LeadInfo } from "./dashboard-lead-presentation";
import { compareLeadPriority, queuePriority } from "./dashboard-lead-priority";
import { buildDashboardLeadRows } from "./dashboard-lead-rows";
import {
  deriveLeadQueueState,
  type LeadBuildContext,
  type LeadQueueState,
} from "./dashboard-lead-state";

interface BuildLeadInfosArgs {
  readonly review?: readonly SubmissionDashboardRow[] | undefined;
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse | undefined;
  readonly now: Date;
  readonly currentUserId?: string | undefined;
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
  const sectionSubmittedAt = state.section?.submittedAt;

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
    submittedAtLabel: sectionSubmittedAt
      ? toIsoDateString(sectionSubmittedAt)
      : null,
    ...sectionIdentity(state.section, state.activity),
    reviews: state.reviews,
    ...state.review,
    attentionLabel: attentionLabel(state.trafficLights),
    reminderRuleId: context.weeklyReport.activeDeadlineReminderRuleId,
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
}: BuildLeadInfosArgs): readonly LeadInfo[] {
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

export function primaryAction(lead: LeadInfo): PrimaryAction {
  if (lead.actions.canReview) return "review";
  if (lead.actions.canOpen) return "open";
  if (lead.actions.canRemind) return "remind";
  return "none";
}
