import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const PUBLISHED_ITEM_LINEAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_ITEM_LINEAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const section: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  version: 1,
  status: "draft",
  submittedAt: null,
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
    },
  ],
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
      stageIds: ["Development"],
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
      stageIds: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
};

function writeItemsFrom(source: ReportSectionReadModel) {
  return source.items.map((item) => ({ ...item, stageIds: ["Development"] }));
}

function createRepository(
  publishedItemLineage: readonly string[],
): ReportSectionsRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
    async getSectionById() {
      return structuredClone(section);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
    async getReportStatus() {
      return "draft";
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
    async getPublishedLineage() {
      return { itemStableIds: publishedItemLineage, decisionStableIds: [] };
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
    async saveSection(nextSection) {
      return structuredClone(nextSection);
    },
  };
}

function basePayload() {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID, status: "green" as const }],
    items: writeItemsFrom(section),
    risks: [],
    decisions: [],
  };
}

describe("resolve-not-delete save guard", () => {
  it("rejects a saveDraft whose payload drops a published-lineage item", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
    );
    const payload = basePayload();
    await expect(
      service.saveDraft({
        ...payload,
        items: payload.items.filter(
          (item) => item.stableId !== PUBLISHED_ITEM_LINEAGE,
        ),
      }),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
  });

  it("rejects a payload that rewrites the published stableId (identity evasion)", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
    );
    const payload = basePayload();
    await expect(
      service.saveDraft({
        ...payload,
        items: payload.items.map((item) =>
          item.stableId === PUBLISHED_ITEM_LINEAGE
            ? { ...item, stableId: "99999999-9999-4999-8999-999999999999" }
            : item,
        ),
      }),
    ).rejects.toBeInstanceOf(ReportSectionDomainError);
  });

  it("allows deleting a never-published draft record", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
    );
    const payload = basePayload();
    const saved = await service.saveDraft({
      ...payload,
      items: payload.items.filter(
        (item) => item.stableId !== DRAFT_ITEM_LINEAGE,
      ),
    });
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]?.stableId).toBe(PUBLISHED_ITEM_LINEAGE);
  });

  it("allows resolving a published record in place (mark done, same lineage)", async () => {
    const service = new ReportSectionsService(
      createRepository([PUBLISHED_ITEM_LINEAGE]),
    );
    const payload = basePayload();
    const saved = await service.saveDraft({
      ...payload,
      items: payload.items.map((item) =>
        item.stableId === PUBLISHED_ITEM_LINEAGE
          ? { ...item, workflowStatus: "done" as const, completed: true }
          : item,
      ),
    });
    expect(
      saved.items.find((item) => item.stableId === PUBLISHED_ITEM_LINEAGE)
        ?.workflowStatus,
    ).toBe("done");
  });
});
