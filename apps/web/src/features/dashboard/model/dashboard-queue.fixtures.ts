import type {
  ActivityLiveResponse,
  ReportSectionReadModel,
  SectionReviewView,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const GROUP_ID = "10000000-0000-4000-8000-000000000002";
const REVIEWER_ID = "10000000-0000-4000-8000-000000000003";
const UUID_SUFFIX_LENGTH = 12;
const DEFAULT_TOTAL_LEADS = 5;

export const QUEUE_NOW = new Date("2026-07-16T12:00:00.000Z");

export const queueLeadId = (suffix: number) =>
  `20000000-0000-4000-8000-${suffix.toString().padStart(UUID_SUFFIX_LENGTH, "0")}`;
const sectionId = (suffix: number) =>
  `30000000-0000-4000-8000-${suffix.toString().padStart(UUID_SUFFIX_LENGTH, "0")}`;

export function queueReviewRow(
  id: string,
  name: string,
): SubmissionDashboardRow {
  return {
    leadId: id,
    leadName: name,
    role: "lead",
    projectNames: [`${name} Product`],
    status: "draft",
    submittedAt: null,
  };
}

export function queueVerdict(
  value: SectionReviewView["verdict"],
  isCurrent = true,
): SectionReviewView {
  return {
    reviewerId: REVIEWER_ID,
    reviewerName: "Harper Head",
    verdict: value,
    judgedVersion: 2,
    isCurrent,
    createdAt: new Date("2026-07-16T09:00:00.000Z"),
  };
}

export function queueSection(
  id: string,
  name: string,
  status: ReportSectionReadModel["status"],
  options: {
    readonly canReview?: boolean;
    readonly reviews?: readonly SectionReviewView[];
  } = {},
): ReportSectionReadModel {
  return {
    reportSectionId: sectionId(Number(id.slice(-UUID_SUFFIX_LENGTH))),
    reportId: REPORT_ID,
    authorId: id,
    authorName: name,
    authorRole: "lead",
    version: 2,
    status,
    submittedAt:
      status === "submitted" ? new Date("2026-07-16T10:00:00.000Z") : null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    groupId: GROUP_ID,
    canReview: options.canReview ?? false,
    reviews: [...(options.reviews ?? [])],
  };
}

export function queueActivityRow(
  id: string,
  name: string,
  options: {
    readonly content?: number;
    readonly lastEditAt?: Date | null;
    readonly status?: "draft" | "submitted";
  } = {},
): ActivityLiveResponse["rows"][number] {
  return {
    reportId: REPORT_ID,
    reportSectionId: sectionId(Number(id.slice(-UUID_SUFFIX_LENGTH))),
    leadId: id,
    leadName: name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
    status: options.status ?? "draft",
    itemCount: options.content ?? 0,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    lastEditAt: options.lastEditAt ?? null,
    submittedAt:
      options.status === "submitted"
        ? new Date("2026-07-16T10:00:00.000Z")
        : null,
  };
}

export function queueReport(
  leadSections: readonly ReportSectionReadModel[],
  periodStatus: WeeklyReportReadModel["periodStatus"] = "open",
  totalLeads = DEFAULT_TOTAL_LEADS,
): WeeklyReportReadModel {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-07-13T00:00:00.000Z"),
    periodEnd: new Date("2026-07-19T23:59:59.000Z"),
    deadline: new Date("2026-07-17T15:00:00.000Z"),
    periodStatus,
    archived: false,
    weekLabel: "Week 29",
    submissionCount: leadSections.filter((row) => row.status === "submitted")
      .length,
    totalLeads,
    hasActiveReminderRule: true,
    portfolioOverview: [],
    leadSections: [...leadSections],
    escalations: [],
  };
}

export function queueActivity(
  rows: ActivityLiveResponse["rows"],
  periodStatus: WeeklyReportReadModel["periodStatus"] = "open",
): ActivityLiveResponse {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-07-13T00:00:00.000Z"),
    periodEnd: new Date("2026-07-19T23:59:59.000Z"),
    periodStatus,
    rows,
  };
}
