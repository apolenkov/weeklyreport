import { reportSectionReadModelSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { chunks, semanticDocuments } from "./semantic-preparation.documents.js";

const uuid = (suffix: string): string =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("chunks", () => {
  it.each([
    { values: [], size: 3, expected: [] },
    { values: [1, 2, 3], size: 1, expected: [[1], [2], [3]] },
    { values: [1, 2, 3, 4, 5], size: 2, expected: [[1, 2], [3, 4], [5]] },
    { values: [1, 2, 3], size: 3, expected: [[1, 2, 3]] },
    { values: [1, 2], size: 5, expected: [[1, 2]] },
  ])("partitions deterministically", ({ values, size, expected }) => {
    expect(chunks(values, size)).toEqual(expected);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid size %s",
    (size) => {
      expect(() => chunks([1], size)).toThrow(
        "Chunk size must be a positive integer",
      );
    },
  );

  it("handles a large input in one linear pass", () => {
    const values = Array.from({ length: 10_000 }, (_, index) => index);
    const result = chunks(values, 97);

    expect(result.flat()).toEqual(values);
    expect(result).toHaveLength(Math.ceil(values.length / 97));
  });
});

describe("semanticDocuments", () => {
  it("keeps the first document for duplicate content hashes", () => {
    const projectId = uuid("1");
    const section = (sectionId: string, reportId: string) =>
      reportSectionReadModelSchema.parse({
        reportSectionId: uuid(sectionId),
        reportId: uuid(reportId),
        authorId: uuid("2"),
        authorName: "Lead",
        authorRole: "lead",
        version: 1,
        status: "draft",
        submittedAt: null,
        projects: [
          {
            projectId,
            projectName: "Product",
            trafficLight: "green",
            ownedStages: [],
            stageSet: [],
          },
        ],
        items: [
          {
            id: uuid("3"),
            projectId,
            type: "current",
            text: "Same content",
            tag: "status",
            workflowStatus: "done",
            carriedOver: false,
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
        activities: [],
        reviews: [],
      });
    const occurrences = [
      {
        reportId: uuid("100"),
        periodId: uuid("200"),
        periodLabel: "Current",
        periodStart: new Date("2026-08-24T00:00:00.000Z"),
        source: "live" as const,
        sections: [section("10", "100")],
      },
      {
        reportId: uuid("101"),
        periodId: uuid("201"),
        periodLabel: "Previous",
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        source: "snapshot" as const,
        sections: [section("11", "101")],
      },
    ];

    const documents = semanticDocuments(occurrences, "v1");

    expect(documents).toHaveLength(1);
    expect(documents[0]?.locator.reportId).toBe(uuid("100"));
  });
});
