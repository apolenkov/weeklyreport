import { describe, expect, it } from "vitest";

import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
} from "./published-report-snapshot.js";

type Row = Parameters<typeof buildAssembledReportFromPrismaRow>[0];

const groupId = crypto.randomUUID();
const section = {
  id: crypto.randomUUID(),
  reportId: crypto.randomUUID(),
  authorId: crypto.randomUUID(),
  version: 2,
  status: "submitted",
  submittedAt: new Date("2026-09-28T10:00:00Z"),
  late: false,
  author: {
    name: "Lead",
    role: "lead",
    stageAssignments: [],
    reportingGroupId: groupId,
    reportingGroup: { id: groupId, name: "Group" },
  },
  items: [],
  risks: [],
  decisions: [],
  activityStatuses: [],
  itemOutcomeEvents: [],
  stageStatuses: [],
  projectStatuses: [],
  sectionReviews: [
    {
      reviewer: { name: "Head" },
      reviewerId: crypto.randomUUID(),
      verdict: "changes_requested",
      judgedVersion: 2,
      comment: "Private reviewer reason",
      createdAt: new Date("2026-09-28T11:00:00Z"),
    },
  ],
};

describe("buildAssembledReportFromPrismaRow", () => {
  it("orders shuffled authors for the Russian preview and preserves equal-name input order", () => {
    const reportId = crypto.randomUUID();
    const makeSection = (name: string) => ({
      ...section,
      id: crypto.randomUUID(),
      reportId,
      authorId: crypto.randomUUID(),
      author: { ...section.author, name },
    });
    const firstZoe = makeSection("Zoe");
    const secondZoe = makeSection("Zoe");
    const rows = [
      firstZoe,
      makeSection("Борис"),
      makeSection("Alice"),
      secondZoe,
      makeSection("Алина"),
    ];
    const originalIds = rows.map(({ id }) => id);
    const report = buildAssembledReportFromPrismaRow({
      id: reportId,
      periodStart: new Date("2026-09-21T00:00:00Z"),
      periodEnd: new Date("2026-09-27T00:00:00Z"),
      deadline: new Date("2026-09-28T00:00:00Z"),
      status: "published",
      publishedAt: new Date("2026-09-29T00:00:00Z"),
      publishedById: crypto.randomUUID(),
      publishedBy: { name: "Head" },
      sections: rows,
    } as unknown as Row);

    expect(report.sections.map(({ authorName }) => authorName)).toEqual([
      "Алина",
      "Борис",
      "Alice",
      "Zoe",
      "Zoe",
    ]);
    expect(
      report.sections
        .filter(({ authorName }) => authorName === "Zoe")
        .map(({ reportSectionId }) => reportSectionId),
    ).toEqual([firstZoe.id, secondZoe.id]);
    expect(rows.map(({ id }) => id)).toEqual(originalIds);
    expect(report.sections.every((row) => row.groupId === groupId)).toBe(true);
  });

  it("does not freeze reviewer comments into the published snapshot", () => {
    expect(reportFullIncludeForSnapshot.sections.include).toBeDefined();
    const report = buildAssembledReportFromPrismaRow({
      id: crypto.randomUUID(),
      periodStart: new Date("2026-09-21T00:00:00Z"),
      periodEnd: new Date("2026-09-27T00:00:00Z"),
      deadline: new Date("2026-09-28T00:00:00Z"),
      status: "published",
      publishedAt: new Date("2026-09-29T00:00:00Z"),
      publishedById: crypto.randomUUID(),
      publishedBy: { name: "Head" },
      sections: [section],
    } as unknown as Row);

    expect(report.sections[0]?.reviews).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain("Private reviewer reason");
    expect(report.sections[0]?.reviews[0]).not.toHaveProperty("comment");
  });
});
