import type {
  ProjectReadModel,
  ReportSectionReadModel,
  SectionActivity,
} from "@customreport/shared";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const SECTION_ID = "10000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "10000000-0000-4000-8000-000000000003";
const PROJECT_ID = "10000000-0000-4000-8000-000000000004";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000005";

export function makeProjectReadModel(
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

export function makeSectionActivity(
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

export function makeReportSectionReadModel(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
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
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    ...overrides,
  };
}
