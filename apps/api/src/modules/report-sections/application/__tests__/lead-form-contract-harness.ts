import type { ReportSectionReadModel } from "@customreport/shared";
import { vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import {
  type LeadFormRepository,
  type ReopenEligibilityFacts,
} from "../lead-form.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const SECTION_ID = "11111111-1111-4111-8111-111111111111";
export const SOURCE_SECTION_ID = "11111111-1111-4111-8111-222222222222";
export const REPORT_ID = "22222222-2222-4222-8222-222222222222";
export const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_USER_ID = "33333333-3333-4333-8333-444444444444";
export const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

export const draftSection: ReportSectionReadModel = {
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
      projectId: PROJECT_ID,
      projectName: "Project Alpha",
      trafficLight: null,
      ownedStages: [],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [
    {
      projectId: PROJECT_ID,
      type: "current",
      text: "Deliver feature X",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
};

export const submittedSection: ReportSectionReadModel = {
  ...draftSection,
  status: "submitted",
  submittedAt: new Date("2026-04-06T12:00:00Z"),
  projects: [
    { ...expectDefined(draftSection.projects[0]), trafficLight: "green" },
  ],
};

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

export function createMockRepository(
  overrides: Partial<LeadFormRepository> = {},
): LeadFormRepository {
  return {
    resolvePlan: vi.fn(),
    restorePlan: vi.fn(),
    getOpenWorkHistoryPage: vi.fn().mockResolvedValue({
      occurrences: [],
      nextCursor: null,
    }),
    getSectionById: vi.fn().mockResolvedValue(null),
    getSectionByIdScoped: vi.fn().mockResolvedValue(null),
    getUserReportingGroupId: vi.fn().mockResolvedValue(null),
    getSectionForPeriod: vi.fn().mockResolvedValue(null),
    getSectionForPeriodAsGroupPeer: vi.fn().mockResolvedValue(null),
    getStatusOverviewPeriods: vi.fn().mockResolvedValue(null),
    getSectionReopenContext: vi.fn().mockResolvedValue(null),
    getReportPeriodStatusForSection: vi.fn().mockResolvedValue("open"),
    getPublishedLineage: vi
      .fn()
      .mockResolvedValue({ itemStableIds: [], decisionStableIds: [] }),
    revokeSectionSubmission: vi.fn().mockResolvedValue(undefined),
    fillFromSection: vi.fn().mockResolvedValue(5),
    createReopenRequest: vi.fn().mockResolvedValue(undefined),
    getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
    getCrossAuthors: vi.fn().mockResolvedValue([]),
    getCrossAuthorContent: vi
      .fn()
      .mockResolvedValue({ coOwnsShared: false, rows: [] }),
    revokeAllSubmitted: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

// Helpers: build the repo return shapes that carry the period-lifecycle facts.
export function forPeriod(
  section: ReportSectionReadModel,
  readOnly: boolean,
  facts: Partial<ReopenEligibilityFacts> = {},
): {
  section: ReportSectionReadModel;
  readOnly: boolean;
  reopenFacts: ReopenEligibilityFacts;
} {
  return {
    section,
    readOnly,
    reopenFacts: {
      sectionStatus: section.status,
      periodStatus: "open",
      archived: false,
      hasPendingReopen: false,
      ...facts,
    },
  };
}

export function reopenContext(
  facts: Partial<ReopenEligibilityFacts> = {},
  authorId = AUTHOR_ID,
): { authorId: string; facts: ReopenEligibilityFacts } {
  return {
    authorId,
    facts: {
      sectionStatus: "submitted",
      periodStatus: "open",
      archived: false,
      hasPendingReopen: false,
      ...facts,
    },
  };
}

// Shared reporting-group identity for the head and in-group target fixtures.
export const HEAD_GROUP_ID = "66666666-6666-4666-8666-666666666661";
