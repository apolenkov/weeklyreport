import type {
  ProjectReadModel,
  ReportSectionReadModel,
  SectionActivity,
  WeeklyReportReadModel,
} from "@weeklyreport/shared";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const SECTION_ID = "10000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "10000000-0000-4000-8000-000000000003";
const PROJECT_ID = "10000000-0000-4000-8000-000000000004";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000005";

export type ProjectFixture = Partial<ProjectReadModel> &
  Pick<ProjectReadModel, "projectId" | "projectName" | "trafficLight">;

export type ActivityFixture = Partial<SectionActivity> &
  Pick<SectionActivity, "activityId" | "activityName" | "status">;

type SectionRecordFixture<T> = Omit<T, "stageNames"> & {
  stageNames?: readonly string[];
};

export type ReportSectionFixture = Omit<
  Partial<ReportSectionReadModel>,
  "activities" | "projects" | "items" | "risks" | "decisions"
> & {
  activities?: readonly ActivityFixture[];
  projects?: readonly ProjectFixture[];
  items?: readonly SectionRecordFixture<
    ReportSectionReadModel["items"][number]
  >[];
  risks?: readonly SectionRecordFixture<
    ReportSectionReadModel["risks"][number]
  >[];
  decisions?: readonly SectionRecordFixture<
    ReportSectionReadModel["decisions"][number]
  >[];
};

export type WeeklyReportFixture = Omit<
  Partial<WeeklyReportReadModel>,
  "leadSections"
> & {
  leadSections?: readonly ReportSectionFixture[];
};

export function makeProjectFixture(
  overrides: Partial<ProjectReadModel> = {},
): ProjectReadModel {
  return {
    projectId: PROJECT_ID,
    projectName: "Test project",
    trafficLight: null,
    ownedStages: [],
    stageSet: [],
    ownerGroupId: null,
    ...overrides,
  };
}

export function makeActivityFixture(
  overrides: Partial<SectionActivity> = {},
): SectionActivity {
  return {
    activityId: ACTIVITY_ID,
    activityName: "Test activity",
    status: null,
    jiraAccounts: [],
    linkedProducts: [],
    derivedStatus: null,
    alarmFloor: null,
    ...overrides,
  };
}

export function makeReportSectionFixture(
  overrides: ReportSectionFixture = {},
): ReportSectionReadModel {
  const {
    activities = [],
    projects = [],
    items = [],
    risks = [],
    decisions = [],
    ...sectionOverrides
  } = overrides;
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: projects.map((project) => makeProjectFixture(project)),
    referencedProjects: [],
    items: items.map((item) => ({
      ...item,
      stageNames:
        item.stageNames ?? (item.activityId != null ? [] : ["Planning"]),
    })),
    risks: risks.map((risk) => ({
      ...risk,
      stageNames:
        risk.stageNames ?? (risk.activityId != null ? [] : ["Planning"]),
    })),
    decisions: decisions.map((decision) => ({
      ...decision,
      stageNames:
        decision.stageNames ??
        (decision.activityId != null ? [] : ["Planning"]),
    })),
    activities: activities.map((activity) => makeActivityFixture(activity)),
    reviews: [],
    ...sectionOverrides,
  };
}

export function makeWeeklyReportFixture(
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  const { leadSections = [], ...reportOverrides } = overrides;
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    deadline: new Date("2026-04-17T15:00:00Z"),
    periodState: "open",
    periodStatus: "open",
    archived: false,
    weekLabel: "Week 16",
    submissionCount: 0,
    totalLeads: 0,
    activeDeadlineReminderRuleId: "a0000000-0000-4000-a000-000000000600",
    portfolioOverview: [],
    leadSections: leadSections.map((section) =>
      makeReportSectionFixture(section),
    ),
    escalations: [],
    ...reportOverrides,
  };
}
