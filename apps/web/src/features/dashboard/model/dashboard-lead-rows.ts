import type {
  ActivityLiveResponse,
  ActivityLiveRow,
  ReportSectionReadModel,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

interface DashboardLeadRowsInput {
  readonly review?: readonly SubmissionDashboardRow[];
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse;
}

function sectionDashboardRow(
  section: ReportSectionReadModel,
): SubmissionDashboardRow {
  return {
    leadId: section.authorId,
    leadName: section.authorName,
    role: section.authorRole ?? "lead",
    projectNames: section.projects.map((project) => project.projectName),
    status: section.status,
    submittedAt: section.submittedAt,
  };
}

function activityDashboardRow(
  row: ActivityLiveRow,
  section: ReportSectionReadModel | undefined,
): SubmissionDashboardRow {
  return {
    leadId: row.leadId,
    leadName: row.leadName,
    role: section?.authorRole ?? "lead",
    projectNames: section?.projects.map((project) => project.projectName) ?? [],
    status: row.status,
    submittedAt: row.submittedAt,
  };
}

function replaceDashboardRow(
  rows: readonly SubmissionDashboardRow[],
  next: SubmissionDashboardRow,
): SubmissionDashboardRow[] {
  return [...rows.filter((row) => row.leadId !== next.leadId), next];
}

export function buildDashboardLeadRows({
  review = [],
  weeklyReport,
  activity,
}: DashboardLeadRowsInput): SubmissionDashboardRow[] {
  const sections = weeklyReport.leadSections;
  const sectionByAuthor = new Map(
    sections.map((section) => [section.authorId, section]),
  );
  const progressiveRows = [
    ...sections.map(sectionDashboardRow),
    ...(activity?.rows.map((row) =>
      activityDashboardRow(row, sectionByAuthor.get(row.leadId)),
    ) ?? []),
    ...review,
  ];
  return progressiveRows.reduce<SubmissionDashboardRow[]>(
    replaceDashboardRow,
    [],
  );
}
