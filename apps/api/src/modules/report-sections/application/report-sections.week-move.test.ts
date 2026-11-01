// Lead plan direct manipulation (TASK-766): moving an item between the current
// and next week is a plain `type` change on the section draft save. The
// client-supplied stableId, text and progress must survive the move unchanged.
import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import {
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_STABLE_ID = "66666666-6666-4666-8666-666666666666";

type DraftItem = DraftSavePayload["items"][number];
type ItemType = "current" | "next";

// The moved row as the client sends it: stableId, text and progress are the
// identity and content that a week move must not rewrite.
const movingItem = {
  stableId: ITEM_STABLE_ID,
  projectId: PROJECT_ID,
  text: "Migrate billing export",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  stageNames: ["Development"],
};

function sectionWithItem(type: ItemType): ReportSectionReadModel {
  return {
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
        projectName: "Project 1",
        trafficLight: null,
        ownedStages: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 0 },
        ],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [],
    items: [{ ...movingItem, type }],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

function draftPayload(items: readonly DraftItem[]): DraftSavePayload {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft",
    stageStatuses: [],
    activityStatuses: [],
    projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
    items,
    risks: [],
    decisions: [],
  };
}

// Stateful fake: the stored section follows each saveSection, so a second save
// is loaded from what the first one persisted.
function createRepository(initial: ReportSectionReadModel) {
  let current = structuredClone(initial);
  const saveSection = vi.fn(
    (next: ReportSectionReadModel, _expectedVersion: number) => {
      current = structuredClone(next);
      return Promise.resolve(structuredClone(current));
    },
  );

  const repo: ReportSectionsRepository = {
    getSectionById(reportSectionId) {
      return Promise.resolve(
        reportSectionId === current.reportSectionId
          ? structuredClone(current)
          : null,
      );
    },
    getReportPeriodWriteGateForSection() {
      return Promise.resolve({ periodStatus: "open", archived: false });
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
    getPublishedLineage() {
      return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
    },
    saveSection,
    getMyHistoryPage() {
      return Promise.resolve({ items: [], nextCursor: null });
    },
  };

  return { repo, saveSection };
}

function createService(initial: ReportSectionReadModel) {
  const { repo, saveSection } = createRepository(initial);
  const service = new ReportSectionsService(
    repo,
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
  return { service, saveSection };
}

// Fields a week move must leave untouched; only `type` may change.
function immutableFields(item: {
  stableId?: string | undefined;
  text: string;
  tag: string;
  workflowStatus: DraftItem["workflowStatus"];
}) {
  return {
    stableId: item.stableId,
    text: item.text,
    tag: item.tag,
    workflowStatus: item.workflowStatus,
  };
}

describe("week move through the section draft save", () => {
  it.each([
    { from: "current", to: "next" },
    { from: "next", to: "current" },
  ] as const)(
    "moves an item $from → $to and keeps stableId, text and progress",
    async ({ from, to }) => {
      const { service, saveSection } = createService(sectionWithItem(from));

      const saved = await service.saveDraft(
        draftPayload([{ ...movingItem, type: to }]),
        AUTHOR_ID,
      );

      expect(saveSection).toHaveBeenCalledTimes(1);
      const [persisted, expectedVersion] = expectDefined(
        saveSection.mock.calls.at(0),
      );
      expect(expectedVersion).toBe(1);
      expect(persisted.status).toBe("draft");
      expect(persisted.items).toHaveLength(1);
      expect(persisted.items.at(0)?.type).toBe(to);
      expect(immutableFields(expectDefined(persisted.items.at(0)))).toEqual(
        immutableFields(movingItem),
      );

      expect(saved.items).toHaveLength(1);
      expect(saved.items.at(0)?.type).toBe(to);
      expect(immutableFields(expectDefined(saved.items.at(0)))).toEqual(
        immutableFields(movingItem),
      );
    },
  );

  it("round-trips an item current → next → current with a stable stableId", async () => {
    const { service, saveSection } = createService(sectionWithItem("current"));

    const movedNext = await service.saveDraft(
      draftPayload([{ ...movingItem, type: "next" }]),
      AUTHOR_ID,
    );
    const movedNextItem = expectDefined(movedNext.items.at(0));
    const movedBack = await service.saveDraft(
      draftPayload([{ ...movedNextItem, type: "current" }]),
      AUTHOR_ID,
    );

    expect(saveSection).toHaveBeenCalledTimes(2);
    expect(movedNext.items.at(0)?.type).toBe("next");
    expect(movedBack.items.at(0)?.type).toBe("current");
    expect(movedBack.items.at(0)?.stableId).toBe(ITEM_STABLE_ID);
    expect(immutableFields(expectDefined(movedBack.items.at(0)))).toEqual(
      immutableFields(movingItem),
    );
  });
});
