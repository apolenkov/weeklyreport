import type { DraftSaveInput } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { findPublishedRecordViolation } from "./published-record-guard";

const ITEM_LINEAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_LINEAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_LINEAGE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function payload(overrides: Partial<DraftSaveInput> = {}): DraftSaveInput {
  return {
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    status: "draft",
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: [],
    items: [
      {
        stableId: ITEM_LINEAGE,
        projectId: "44444444-4444-4444-8444-444444444444",
        type: "current",
        text: "Published item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: ["Development"],
      },
    ],
    risks: [],
    decisions: [
      {
        stableId: DECISION_LINEAGE,
        text: "Published decision",
        owner: "Head",
        deadline: null,
        impact: "Impact",
        resolvedAt: null,
        stageIds: ["Development"],
        productId: "44444444-4444-4444-8444-444444444444",
      },
    ],
    ...overrides,
  };
}

const published = {
  itemStableIds: [ITEM_LINEAGE],
  decisionStableIds: [DECISION_LINEAGE],
};

describe("findPublishedRecordViolation", () => {
  it("passes when every published lineage is preserved in the payload", () => {
    expect(findPublishedRecordViolation(published, payload())).toBeNull();
  });

  it("passes trivially when nothing is published", () => {
    expect(
      findPublishedRecordViolation(
        { itemStableIds: [], decisionStableIds: [] },
        payload({ items: [], decisions: [] }),
      ),
    ).toBeNull();
  });

  it("rejects a payload that omits a published item lineage (a delete)", () => {
    const violation = findPublishedRecordViolation(
      published,
      payload({ items: [] }),
    );
    expect(violation?.code).toBe("PUBLISHED_RECORD_LOCKED");
  });

  it("rejects a payload that rewrites a published stableId (an evasion)", () => {
    const rewritten = payload();
    const violation = findPublishedRecordViolation(published, {
      ...rewritten,
      items: rewritten.items.map((item) => ({
        ...item,
        stableId: OTHER_LINEAGE,
      })),
    });
    expect(violation?.code).toBe("PUBLISHED_RECORD_LOCKED");
  });

  it("rejects a payload that omits a published decision lineage", () => {
    const violation = findPublishedRecordViolation(
      published,
      payload({ decisions: [] }),
    );
    expect(violation?.code).toBe("PUBLISHED_RECORD_LOCKED");
  });

  it("keeps a resolved (done) published record savable — resolution is not deletion", () => {
    const base = payload();
    const resolved = {
      ...base,
      items: base.items.map((item) => ({
        ...item,
        workflowStatus: "done" as const,
        completed: true,
      })),
      decisions: base.decisions.map((decision) => ({
        ...decision,
        resolvedAt: new Date(),
      })),
    };
    expect(findPublishedRecordViolation(published, resolved)).toBeNull();
  });

  it("allows dropping a never-published record while published ones stay", () => {
    const base = payload();
    const withDraftRow = {
      ...base,
      items: base.items.flatMap((item) => [
        item,
        { ...item, stableId: OTHER_LINEAGE, text: "Draft item" },
      ]),
    };
    // The draft row (OTHER_LINEAGE) is not in the published set, so a later
    // payload without it is fine as long as the published row remains.
    expect(findPublishedRecordViolation(published, withDraftRow)).toBeNull();
    expect(findPublishedRecordViolation(published, base)).toBeNull();
  });
});
