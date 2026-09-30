import type {
  DraftSavePayload,
  PeriodStatus,
  ReportSectionReadModel,
} from "@customreport/shared";

import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import type { ReportSectionsRepository } from "./report-sections.service";

export const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
export const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
export const PROJECT_ID_1 = "44444444-4444-4444-8444-444444444444";
export const PROJECT_ID_2 = "55555555-5555-4555-8555-555555555555";

export const baseSection: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: PROJECT_ID_1,
      projectName: "Project Alpha",
      trafficLight: null,
      // the author owns the Development stage
      // on this project, so the write payloads (stageNames: ["Development"]) pass
      // the stage-ownership guard.
      ownedStages: [
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageName: "Development",
          sortOrder: 0,
        },
      ],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [
    {
      projectId: PROJECT_ID_1,
      type: "current",
      text: "Deliver feature X",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      // items carry ≥1 stage on write.
      stageNames: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
};

export function createRepository(
  section: ReportSectionReadModel,
  periodStatus: PeriodStatus | null = "open",
): ReportSectionsRepository {
  const currentSection = { value: structuredClone(section) };

  return {
    getSectionById(reportSectionId) {
      return Promise.resolve(
        reportSectionId === currentSection.value.reportSectionId
          ? structuredClone(currentSection.value)
          : null,
      );
    },
    getReportPeriodWriteGateForSection() {
      return Promise.resolve(
        periodStatus === null ? null : { periodStatus, archived: false },
      );
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
    getPublishedLineage() {
      return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
    },
    saveSection(nextSection) {
      currentSection.value = structuredClone(nextSection);
      return Promise.resolve(structuredClone(currentSection.value));
    },
    getMyHistoryPage() {
      return Promise.resolve({ items: [], nextCursor: null });
    },
  };
}

export function validDraft(
  overrides: Partial<DraftSavePayload> = {},
): DraftSavePayload {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" as const }],
    stageStatuses: [],
    activityStatuses: [],
    items: baseSection.items,
    risks: [],
    decisions: [],
    ...overrides,
  };
}
