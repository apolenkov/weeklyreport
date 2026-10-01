import { describe, expect, it } from "vitest";

import {
  leadOpenWorkHistoryInputSchema,
  leadOpenWorkHistoryOutputSchema,
} from "./open-work-history.schema.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const STABLE_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";

describe("leadOpenWorkHistoryInputSchema", () => {
  it("defaults to a bounded ten-report page", () => {
    expect(
      leadOpenWorkHistoryInputSchema.parse({ reportId: REPORT_ID }),
    ).toEqual({ reportId: REPORT_ID, limit: 10 });
  });

  it.each([0, 26, 1.5])("rejects an invalid report limit %s", (limit) => {
    expect(
      leadOpenWorkHistoryInputSchema.safeParse({
        reportId: REPORT_ID,
        limit,
      }).success,
    ).toBe(false);
  });
});

describe("leadOpenWorkHistoryOutputSchema", () => {
  const occurrence = {
    source: "published" as const,
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    periodStart: new Date("2026-08-17T00:00:00.000Z"),
    periodEnd: new Date("2026-08-23T23:59:59.999Z"),
    parent: { kind: "product" as const, id: PROJECT_ID, name: "Platform" },
    item: {
      id: ITEM_ID,
      stableId: STABLE_ID,
      projectId: PROJECT_ID,
      activityId: null,
      type: "current" as const,
      text: "Finished historical task",
      tag: "delivery",
      workflowStatus: "done" as const,
      carriedOver: false,
      priorityRank: null,
      pausedReason: null,
      nextStepText: null,
      stageNames: ["Delivery"],
      resolution: null,
      outcomeHistory: [],
    },
  };

  it("keeps terminal full items and source provenance", () => {
    const result = leadOpenWorkHistoryOutputSchema.parse({
      occurrences: [occurrence],
      nextCursor: "opaque",
    });

    expect(result.occurrences[0]).toMatchObject({
      source: "published",
      reportId: REPORT_ID,
      reportSectionId: SECTION_ID,
      parent: { kind: "product", id: PROJECT_ID, name: "Platform" },
      item: {
        id: ITEM_ID,
        stableId: STABLE_ID,
        workflowStatus: "done",
      },
    });
  });

  it("accepts an explicitly unavailable frozen parent name", () => {
    expect(
      leadOpenWorkHistoryOutputSchema.safeParse({
        occurrences: [
          { ...occurrence, parent: { ...occurrence.parent, name: null } },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it.each(["id", "stableId"] as const)(
    "rejects an occurrence without item %s",
    (field) => {
      const item = { ...occurrence.item, [field]: undefined };
      expect(
        leadOpenWorkHistoryOutputSchema.safeParse({
          occurrences: [{ ...occurrence, item }],
          nextCursor: null,
        }).success,
      ).toBe(false);
    },
  );
});
