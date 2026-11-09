import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper.js";
import { queryRetainedDraftCounts } from "./my-history-retained.query.js";
import { queryMyHistoryPage } from "./report-sections.my-history-query.js";

const AUTHOR_ID = "a0000000-0000-4000-8000-000000000001";
const REPORT_ID = "a0000000-0000-4000-8000-000000000010";
const SECTION_ID = "a0000000-0000-4000-8000-000000000011";
const CURRENT_REPORT_ID = "a0000000-0000-4000-8000-000000000020";
const ACTIVITY_ID = "a0000000-0000-4000-8000-000000000030";

const OPEN = { status: "draft", periodStatus: "open", archived: false };
const PUBLISHED = {
  status: "published",
  periodStatus: "published",
  archived: false,
};
const DRAFT_RISK = { impact: null, mitigation: "Escalate" };
const DONE_RISK = { impact: "Slips", mitigation: "Escalate" };
const DRAFT_DECISION = { impact: null };

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: SECTION_ID,
    reportId: REPORT_ID,
    report: OPEN,
    risks: [DRAFT_RISK, DONE_RISK],
    decisions: [DRAFT_DECISION],
    ...overrides,
  };
}

function clientWith(sources: readonly object[]) {
  const findSources = vi.fn().mockResolvedValue(sources);
  const findCurrent = vi.fn().mockResolvedValue({ id: CURRENT_REPORT_ID });
  const prisma = {
    reportSection: { findMany: findSources },
    report: { findFirst: findCurrent },
  } as never;
  return { findCurrent, findSources, prisma };
}

describe("queryRetainedDraftCounts", () => {
  it.each([
    ["an older open source", OPEN, "not-current"],
    ["an archived unpublished source", { ...OPEN, archived: true }, "archived"],
    ["a published source", PUBLISHED, "published"],
    ["an archived publication", { ...PUBLISHED, archived: true }, "archived"],
    [
      "a reopened source",
      { status: "published", periodStatus: "reopened", archived: false },
      "reopened",
    ],
  ] as const)(
    "counts only the unfinished records of %s",
    async (_name, report, readOnlyReason) => {
      const { prisma } = clientWith([source({ report })]);

      const counts = await queryRetainedDraftCounts(prisma, AUTHOR_ID, [
        SECTION_ID,
      ]);

      expect(counts.get(SECTION_ID)).toEqual({
        risks: 1,
        decisions: 1,
        readOnlyReason,
      });
    },
  );

  it("selects sources by current authoring entitlement, not by id alone", async () => {
    const { findSources, prisma } = clientWith([]);

    const counts = await queryRetainedDraftCounts(prisma, AUTHOR_ID, [
      SECTION_ID,
    ]);

    // A demoted, deactivated or foreign actor matches no row, so history
    // carries neither a count nor a recovery link for them.
    expect(counts.size).toBe(0);
    expect(findSources).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: {
          id: { in: [SECTION_ID] },
          authorId: AUTHOR_ID,
          author: {
            isActive: true,
            role: { in: ["lead", "head", "admin"] },
          },
        },
      }),
    );
  });

  it("reads counts only: no record text or identity is selected", async () => {
    const { findSources, prisma } = clientWith([source()]);

    await queryRetainedDraftCounts(prisma, AUTHOR_ID, [SECTION_ID]);

    expect(findSources).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          risks: { select: { impact: true, mitigation: true } },
          decisions: { select: { impact: true } },
        }) as unknown,
      }),
    );
  });

  it("leaves out the section the lead form is editing now", async () => {
    const { prisma } = clientWith([source({ reportId: CURRENT_REPORT_ID })]);

    const counts = await queryRetainedDraftCounts(prisma, AUTHOR_ID, [
      SECTION_ID,
    ]);

    expect(counts.size).toBe(0);
  });

  it("has no entry for a source whose records are all complete", async () => {
    const { findCurrent, prisma } = clientWith([
      source({ risks: [DONE_RISK], decisions: [{ impact: "Scope moves" }] }),
    ]);

    const counts = await queryRetainedDraftCounts(prisma, AUTHOR_ID, [
      SECTION_ID,
    ]);

    expect(counts.size).toBe(0);
    expect(findCurrent).not.toHaveBeenCalled();
  });

  it("asks nothing for an empty page", async () => {
    const { findSources, prisma } = clientWith([]);

    await queryRetainedDraftCounts(prisma, AUTHOR_ID, []);

    expect(findSources).not.toHaveBeenCalled();
  });
});

// One publication of the author's section; `recordOmission` is what it froze.
function publishedReport(recordOmission?: object) {
  const snapshot = publishedSnapshotFixture({
    reportId: REPORT_ID,
    periodStart: "2026-04-14",
    periodEnd: "2026-04-18",
    publishedAt: "2026-04-20T12:00:00.000Z",
    sectionOwners: [
      {
        reportSectionId: SECTION_ID,
        authorId: AUTHOR_ID,
        authorName: "Test Lead",
        groupId: "a0000000-0000-4000-8000-000000000009",
        groupName: "Test Group",
      },
    ],
  }) as { sections: object[] };
  return {
    id: REPORT_ID,
    archived: false,
    publishedSnapshot: {
      ...snapshot,
      sections: snapshot.sections.map((section) =>
        recordOmission ? { ...section, recordOmission } : section,
      ),
    },
  };
}

const TWO_OMITTED_RISKS = {
  version: 1,
  buckets: [
    {
      kind: "risk",
      parentKind: "activity",
      parentId: ACTIVITY_ID,
      stageNames: [],
      count: 2,
    },
  ],
};

async function historyEntry(
  published: object,
  retainedSources: readonly object[],
) {
  const client = {
    reportSection: {
      // The live page read has no id filter; the retained read does.
      findMany: vi.fn((args: { where: { id?: unknown } }) =>
        Promise.resolve(args.where.id ? retainedSources : []),
      ),
    },
    report: {
      findMany: vi.fn().mockResolvedValue([published]),
      findFirst: vi.fn().mockResolvedValue({ id: CURRENT_REPORT_ID }),
    },
  };
  const prisma = {
    $transaction: (operation: (tx: typeof client) => unknown) =>
      Promise.resolve(operation(client)),
  } as never;
  const page = await queryMyHistoryPage(prisma, AUTHOR_ID, { limit: 20 });
  return page.items[0];
}

describe("queryMyHistoryPage — omitted and retained drafts", () => {
  it("keeps the frozen omission count apart from what the source holds now", async () => {
    // Two risks were left out at publication; the author has since finished
    // one, so the source retains a single draft.
    const entry = await historyEntry(publishedReport(TWO_OMITTED_RISKS), [
      source({ report: PUBLISHED, risks: [DRAFT_RISK], decisions: [] }),
    ]);

    expect(entry).toMatchObject({
      publishedOmissions: { risks: 2, decisions: 0, unknown: false },
      retainedDrafts: { risks: 1, decisions: 0, readOnlyReason: "published" },
    });
  });

  it.each([
    ["the live rows are gone after a snapshot restore", []],
    ["the actor is no longer entitled to the source", []],
  ] as const)(
    "keeps the frozen notice without a recovery link when %s",
    async (_name, retainedSources) => {
      const entry = await historyEntry(
        publishedReport(TWO_OMITTED_RISKS),
        retainedSources,
      );

      expect(entry?.publishedOmissions).toEqual({
        risks: 2,
        decisions: 0,
        unknown: false,
      });
      expect(entry?.retainedDrafts).toBeUndefined();
    },
  );

  it("reports a publication older than the count as unknown, not zero", async () => {
    const entry = await historyEntry(publishedReport(), []);

    expect(entry?.publishedOmissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: true,
    });
  });
});
