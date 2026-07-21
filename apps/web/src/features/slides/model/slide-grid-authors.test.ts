import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { CrossAuthorContentRow } from "../../report-sections";
import { buildAuthorRoster } from "./slide-grid-authors";

const section = (
  over: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel => ({
  reportSectionId: "sec-1",
  reportId: "rep-1",
  authorId: "lead-1",
  authorName: "Иванов В.П.",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  ...over,
});

const foreignRow = (
  authorId: string,
  authorName: string,
): CrossAuthorContentRow => ({
  authorId,
  authorName,
  items: [],
  risks: [],
  decisions: [],
});

describe("buildAuthorRoster — color assignment", () => {
  it("cycles foreign authors through slots 1..5, owner keeps slot 0", () => {
    const roster = buildAuthorRoster(
      section(),
      ["a", "b", "c", "d", "e"].map((letter, index) =>
        foreignRow(`co-${String(index)}`, `${letter} ${letter}`),
      ),
    );
    expect(roster.authors.map((a) => a.colorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("never assigns a foreign author the owner's slot 0, even past a 6-author cycle", () => {
    const roster = buildAuthorRoster(
      section(),
      Array.from({ length: 8 }, (_unused, index) =>
        foreignRow(`co-${String(index)}`, `Author ${String(index)}`),
      ),
    );
    const foreignColorIndexes = roster.authors
      .filter((a) => !a.isOwner)
      .map((a) => a.colorIndex);
    expect(foreignColorIndexes).toEqual([1, 2, 3, 4, 5, 1, 2, 3]);
    expect(foreignColorIndexes).not.toContain(0);
  });
});
