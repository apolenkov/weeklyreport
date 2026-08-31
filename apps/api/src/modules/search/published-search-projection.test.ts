import {
  buildPublishedProjections,
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { replacePublishedProjections } from "./published-search-projection.js";

const REPORT_ID = "20000000-0000-4000-8000-000000000001";
const SECTION_ID = "20000000-0000-4000-8000-000000000002";
const GROUP_ID = "20000000-0000-4000-8000-000000000003";
const AUTHOR_ID = "20000000-0000-4000-8000-000000000004";
const ITEM_ID = "20000000-0000-4000-8000-000000000005";
const RISK_ID = "20000000-0000-4000-8000-000000000006";
const DECISION_ID = "20000000-0000-4000-8000-000000000007";
const PROJECT_ID = "20000000-0000-4000-8000-000000000008";
const ITEM_STABLE_ID = "20000000-0000-4000-8000-000000000009";
const RISK_STABLE_ID = "20000000-0000-4000-8000-000000000010";
const DECISION_STABLE_ID = "20000000-0000-4000-8000-000000000011";
const PUBLISHED_AT = new Date("2026-08-24T12:00:00.000Z");

function snapshot(recordSuffix = "v1", includeSearchableRecords = true) {
  return publishedReportSnapshotSchema.parse({
    reportId: REPORT_ID,
    periodStart: "2026-08-24T00:00:00.000Z",
    periodEnd: "2026-08-30T23:59:59.999Z",
    deadline: "2026-08-28T12:00:00.000Z",
    status: "published",
    publishedAt: PUBLISHED_AT,
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [
      {
        reportSectionId: SECTION_ID,
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        authorName: "Lead",
        authorRole: "lead",
        version: 1,
        status: "submitted",
        submittedAt: PUBLISHED_AT,
        late: false,
        projects: [],
        referencedProjects: [],
        items: includeSearchableRecords
          ? [
              {
                id: ITEM_ID,
                stableId: ITEM_STABLE_ID,
                projectId: PROJECT_ID,
                activityId: null,
                type: "current",
                text: `Item ${recordSuffix}`,
                tag: "general",
                workflowStatus: "in_progress",
                carriedOver: false,
                priorityRank: null,
                pausedReason: null,
                stageNames: ["Development"],
              },
            ]
          : [],
        risks: includeSearchableRecords
          ? [
              {
                id: RISK_ID,
                stableId: RISK_STABLE_ID,
                projectId: PROJECT_ID,
                activityId: null,
                risk: `Risk ${recordSuffix}`,
                impact: "Impact",
                mitigation: "Mitigation",
                severity: "at-risk",
                stageNames: ["Development"],
              },
            ]
          : [],
        decisions: includeSearchableRecords
          ? [
              {
                id: DECISION_ID,
                stableId: DECISION_STABLE_ID,
                text: `Decision ${recordSuffix}`,
                owner: "Owner",
                deadline: null,
                impact: "Impact",
                resolvedAt: null,
                stageNames: ["Development"],
                productId: PROJECT_ID,
                activityId: null,
              },
            ]
          : [],
        activities: [],
        reviews: [],
        groupId: GROUP_ID,
        groupName: "Group",
      },
    ],
  });
}

function transaction() {
  return {
    publishedSearchDocument: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    publishedSectionScope: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe("published projections", () => {
  it("rejects duplicate section authors and same-type record identities", () => {
    const base = snapshot();
    const section = expectDefined(base.sections[0]);
    const item = expectDefined(section.items[0]);
    const duplicateAuthor = {
      ...base,
      sections: [
        ...base.sections,
        { ...section, reportSectionId: "20000000-0000-4000-8000-000000000012" },
      ],
    };
    const duplicateRecord = {
      ...base,
      sections: [
        {
          ...section,
          items: [...section.items, item],
        },
      ],
    };
    const duplicateRisk = {
      ...base,
      sections: [
        {
          ...section,
          risks: [...section.risks, expectDefined(section.risks[0])],
        },
      ],
    };
    const duplicateDecision = {
      ...base,
      sections: [
        {
          ...section,
          decisions: [
            ...section.decisions,
            expectDefined(section.decisions[0]),
          ],
        },
      ],
    };

    const duplicateAuthorResult =
      publishedReportSnapshotSchema.safeParse(duplicateAuthor);
    expect(duplicateAuthorResult.success).toBe(false);
    if (!duplicateAuthorResult.success) {
      expect(
        duplicateAuthorResult.error.issues.some(
          (issue) => issue.path.join(".") === "sections.1.authorId",
        ),
      ).toBe(true);
    }
    const duplicateRecordResult =
      publishedReportSnapshotSchema.safeParse(duplicateRecord);
    expect(duplicateRecordResult.success).toBe(false);
    if (!duplicateRecordResult.success) {
      expect(
        duplicateRecordResult.error.issues.some(
          (issue) => issue.path.join(".") === "sections.0.items.1.id",
        ),
      ).toBe(true);
    }
    for (const [duplicate, path] of [
      [duplicateRisk, "sections.0.risks.1.id"],
      [duplicateDecision, "sections.0.decisions.1.id"],
    ] as const) {
      const result = publishedReportSnapshotSchema.safeParse(duplicate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path.join(".") === path),
        ).toBe(true);
      }
    }
  });

  it("reuses snapshot identity validation before writing projections", () => {
    const base = snapshot();
    const section = expectDefined(base.sections[0]);
    const item = expectDefined(section.items[0]);
    const malformed = {
      ...base,
      sections: [
        {
          ...section,
          items: [...section.items, item],
        },
      ],
    } as PublishedReportSnapshot;

    expect(() => buildPublishedProjections(malformed)).toThrow(
      /Record identity/,
    );
  });

  it("derives frozen section admission and searchable records", () => {
    const projections = buildPublishedProjections(snapshot());

    expect(projections.sectionScopes).toEqual([
      {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorId: AUTHOR_ID,
        groupId: GROUP_ID,
      },
    ]);
    expect(projections.searchDocuments).toEqual([
      expect.objectContaining({
        recordType: "item",
        recordId: ITEM_ID,
        stableId: ITEM_STABLE_ID,
        title: "Item v1",
        groupId: GROUP_ID,
        createdAt: PUBLISHED_AT,
      }),
      expect.objectContaining({
        recordType: "risk",
        recordId: RISK_ID,
        stableId: RISK_STABLE_ID,
        searchText: "Risk v1 — Impact — Mitigation",
      }),
      expect.objectContaining({
        recordType: "decision",
        recordId: DECISION_ID,
        stableId: DECISION_STABLE_ID,
        projectId: null,
      }),
    ]);
  });

  it("keeps frozen section admission when the section has no searchable records", () => {
    const projections = buildPublishedProjections(snapshot("v1", false));

    expect(projections.sectionScopes).toEqual([
      {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorId: AUTHOR_ID,
        groupId: GROUP_ID,
      },
    ]);
    expect(projections.searchDocuments).toEqual([]);
  });

  it("replaces the complete report projection on every publication", async () => {
    const tx = transaction();

    await replacePublishedProjections(tx as never, {
      reportId: REPORT_ID,
      snapshot: snapshot("v2"),
    });

    expect(tx.publishedSearchDocument.deleteMany).toHaveBeenCalledWith({
      where: { reportId: REPORT_ID },
    });
    expect(tx.publishedSectionScope.deleteMany).toHaveBeenCalledWith({
      where: { reportId: REPORT_ID },
    });
    const projectionRowsMatcher: unknown = expect.arrayContaining([
      expect.objectContaining({ recordId: ITEM_ID, title: "Item v2" }),
    ]);
    expect(tx.publishedSearchDocument.createMany).toHaveBeenCalledWith({
      data: projectionRowsMatcher,
    });
  });

  it("clears both projections when recovery restores no publication", async () => {
    const tx = transaction();

    await replacePublishedProjections(tx as never, {
      reportId: REPORT_ID,
      snapshot: null,
    });

    expect(tx.publishedSearchDocument.deleteMany).toHaveBeenCalledOnce();
    expect(tx.publishedSectionScope.deleteMany).toHaveBeenCalledOnce();
    expect(tx.publishedSearchDocument.createMany).not.toHaveBeenCalled();
    expect(tx.publishedSectionScope.createMany).not.toHaveBeenCalled();
  });

  it("rejects a mismatched snapshot before any projection write", async () => {
    const tx = transaction();

    await expect(
      replacePublishedProjections(tx as never, {
        reportId: "20000000-0000-4000-8000-000000000009",
        snapshot: snapshot(),
      }),
    ).rejects.toThrow(/snapshot identifies report/);
    expect(tx.publishedSearchDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.publishedSectionScope.deleteMany).not.toHaveBeenCalled();
  });

  it("fails closed on missing frozen ownership before any projection write", async () => {
    const tx = transaction();
    const validSnapshot = snapshot();
    const section = validSnapshot.sections[0];
    if (section === undefined) throw new Error("Expected one section.");

    await expect(
      replacePublishedProjections(tx as never, {
        reportId: REPORT_ID,
        snapshot: {
          ...validSnapshot,
          sections: [{ ...section, groupId: undefined }],
        },
      }),
    ).rejects.toThrow(/Published snapshot integrity failure/);
    expect(tx.publishedSearchDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.publishedSectionScope.deleteMany).not.toHaveBeenCalled();
  });
});
