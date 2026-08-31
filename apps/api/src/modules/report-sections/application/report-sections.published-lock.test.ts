import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const PUBLISHED_ITEM_LINEAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_ITEM_LINEAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const section: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: PROJECT_ID,
      projectName: "Project 1",
      trafficLight: null,
      ownedStages: [
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
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
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      stableId: PUBLISHED_ITEM_LINEAGE,
      projectId: PROJECT_ID,
      type: "current",
      text: "Published item",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      stableId: DRAFT_ITEM_LINEAGE,
      projectId: PROJECT_ID,
      type: "current",
      text: "Never-published draft item",
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

function writeItemsFrom(source: ReportSectionReadModel) {
  return source.items.map((item) => ({ ...item, stageNames: ["Development"] }));
}

function createRepository(
  publishedItemLineage: readonly string[],
): ReportSectionsRepository {
  return {
    getSectionById() {
      return Promise.resolve(structuredClone(section));
    },
    getReportPeriodWriteGateForSection() {
      return Promise.resolve({ periodStatus: "open", archived: false });
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
    getPublishedLineage() {
      return Promise.resolve({
        itemStableIds: publishedItemLineage,
        decisionStableIds: [],
      });
    },
    saveSection(nextSection) {
      return Promise.resolve(structuredClone(nextSection));
    },
    getMyHistoryPage() {
      return Promise.resolve({ items: [], nextCursor: null });
    },
  };
}

function basePayload() {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID, status: "green" as const }],
    stageStatuses: [],
    activityStatuses: [],
    items: writeItemsFrom(section),
    risks: [],
    decisions: [],
  };
}

describe("resolve-not-delete save guard", () => {
  it("rejects a saveDraft whose payload drops a published-lineage item", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
      testGraceSettings,
    );
    const payload = basePayload();
    await expect(
      service.saveDraft(
        {
          ...payload,
          items: payload.items.filter(
            (item) => item.stableId !== PUBLISHED_ITEM_LINEAGE,
          ),
        },
        section.authorId,
      ),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
  });

  it("rejects a payload that rewrites the published stableId (identity evasion)", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
      testGraceSettings,
    );
    const payload = basePayload();
    await expect(
      service.saveDraft(
        {
          ...payload,
          items: payload.items.map((item) =>
            item.stableId === PUBLISHED_ITEM_LINEAGE
              ? { ...item, stableId: "99999999-9999-4999-8999-999999999999" }
              : item,
          ),
        },
        section.authorId,
      ),
    ).rejects.toBeInstanceOf(ReportSectionDomainError);
  });

  it("allows deleting a never-published draft record", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
      testGraceSettings,
    );
    const payload = basePayload();
    const saved = await service.saveDraft(
      {
        ...payload,
        items: payload.items.filter(
          (item) => item.stableId !== DRAFT_ITEM_LINEAGE,
        ),
      },
      section.authorId,
    );
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]?.stableId).toBe(PUBLISHED_ITEM_LINEAGE);
  });

  it("allows resolving a published record in place (mark done, same lineage)", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
      testGraceSettings,
    );
    const payload = basePayload();
    const saved = await service.saveDraft(
      {
        ...payload,
        items: payload.items.map((item) =>
          item.stableId === PUBLISHED_ITEM_LINEAGE
            ? { ...item, workflowStatus: "done" as const, completed: true }
            : item,
        ),
      },
      section.authorId,
    );
    expect(
      saved.items.find((item) => item.stableId === PUBLISHED_ITEM_LINEAGE)
        ?.workflowStatus,
    ).toBe("done");
  });
});
