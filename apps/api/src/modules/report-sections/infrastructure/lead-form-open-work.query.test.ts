import { PublishedSnapshotIntegrityError } from "@weeklyreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  baseRow,
  fullItem,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness.js";
import {
  decodeOpenWorkCursor,
  queryLeadOpenWorkPage,
} from "./lead-form-open-work.query.js";

const TARGET_REPORT_ID = "10000000-0000-4000-8000-000000000001";
const NEWER_REPORT_ID = "20000000-0000-4000-8000-000000000002";
const OLDER_REPORT_ID = "30000000-0000-4000-8000-000000000003";
const NEWER_SECTION_ID = "40000000-0000-4000-8000-000000000004";
const OLDER_SECTION_ID = "50000000-0000-4000-8000-000000000005";
const OTHER_AUTHOR_ID = "60000000-0000-4000-8000-000000000006";
const OTHER_SECTION_ID = "70000000-0000-4000-8000-000000000007";
const STABLE_ID = "80000000-0000-4000-8000-000000000008";
const NEWER_ITEM_ID = "90000000-0000-4000-8000-000000000009";
const OLDER_ITEM_ID = "a0000000-0000-4000-8000-000000000010";
const GROUP_ID = "b0000000-0000-4000-8000-000000000011";

function item(
  id: string,
  overrides: Partial<{
    text: string;
    workflowStatus: "planned" | "in_progress" | "paused" | "done";
    resolution: unknown;
  }> = {},
) {
  return {
    id,
    stableId: STABLE_ID,
    projectId: OWNED_PROJECT,
    activityId: null,
    type: "current",
    text: overrides.text ?? "Tracked task",
    tag: "delivery",
    workflowStatus: overrides.workflowStatus ?? "done",
    carriedOver: false,
    priorityRank: null,
    pausedReason: null,
    nextStepText: null,
    stageNames: ["Development"],
    resolution: overrides.resolution ?? null,
    outcomeHistory: [],
  };
}

function section(
  reportId: string,
  reportSectionId: string,
  authorId: string,
  items: readonly ReturnType<typeof item>[],
) {
  return {
    reportSectionId,
    reportId,
    authorId,
    authorName: authorId === AUTHOR_ID ? "Own Lead" : "Private Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: "2026-08-20T12:00:00.000Z",
    late: false,
    projects: [
      {
        projectId: OWNED_PROJECT,
        projectName: "Frozen Platform",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: GROUP_ID,
      },
    ],
    referencedProjects: [],
    items,
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: GROUP_ID,
    groupName: "Delivery",
  };
}

function snapshot(
  reportId: string,
  reportSectionId: string,
  periodStart: string,
  items: readonly ReturnType<typeof item>[],
) {
  return {
    reportId,
    periodStart,
    periodEnd: new Date(
      new Date(periodStart).getTime() + 6 * 86_400_000,
    ).toISOString(),
    deadline: null,
    status: "published",
    publishedAt: "2026-08-25T08:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [
      section(reportId, reportSectionId, AUTHOR_ID, items),
      section(reportId, OTHER_SECTION_ID, OTHER_AUTHOR_ID, [
        item("c0000000-0000-4000-8000-000000000012", {
          text: "Private item",
        }),
      ]),
    ],
  };
}

function reportRow(
  id: string,
  reportSectionId: string,
  periodStart: string,
  items: readonly ReturnType<typeof item>[],
) {
  return {
    id,
    periodStart: new Date(periodStart),
    periodEnd: new Date(new Date(periodStart).getTime() + 6 * 86_400_000),
    createdAt: new Date(`${periodStart.slice(0, 10)}T10:00:00.000Z`),
    status: "published" as const,
    periodStatus: "published" as const,
    publishedSnapshot: snapshot(id, reportSectionId, periodStart, items),
    publishedSectionScopes: [
      { authorId: AUTHOR_ID, reportSectionId, groupId: GROUP_ID },
    ],
  };
}

function client(options: {
  firstPage: readonly unknown[];
  laterPage?: readonly unknown[];
  liveSection?: unknown;
}) {
  const findMany = vi.fn(
    (args: { where?: { OR?: unknown[] }; take?: number }) =>
      Promise.resolve(
        args.where?.OR ? (options.laterPage ?? []) : options.firstPage,
      ),
  );
  const findFirst = vi.fn().mockResolvedValue(options.liveSection ?? null);
  const tx = {
    report: {
      findUnique: vi.fn().mockResolvedValue({
        periodStart: new Date("2026-09-01T00:00:00.000Z"),
      }),
      findMany,
    },
    reportSection: { findFirst, findUnique: vi.fn() },
  };
  const prisma = {
    $transaction: (
      operation: (transaction: typeof tx) => Promise<unknown>,
      _options: unknown,
    ) => operation(tx),
  } as never;
  return { prisma, findMany, findFirst };
}

describe("queryLeadOpenWorkPage", () => {
  it.each([4, 5, 6, 7, 8])(
    "consumes issued UUID v%s cursors across gaps and terminal shadows",
    async (version) => {
      const newerReportId = `20000000-0000-${version}000-8000-000000000002`;
      const cancelledResolution = {
        kind: "wont_do",
        eventId: "d0000000-0000-4000-8000-000000000013",
        reason: "No longer needed",
        actorId: AUTHOR_ID,
        actorName: "Own Lead",
        occurredAt: "2026-08-05T12:00:00.000Z",
        previousState: {
          type: "current",
          workflowStatus: "planned",
          pausedReason: null,
          nextStepText: null,
        },
      };
      const newer = reportRow(
        newerReportId,
        NEWER_SECTION_ID,
        "2026-08-17T00:00:00.000Z",
        [item(NEWER_ITEM_ID, { workflowStatus: "done" })],
      );
      const older = reportRow(
        OLDER_REPORT_ID,
        OLDER_SECTION_ID,
        "2026-08-03T00:00:00.000Z",
        [item(OLDER_ITEM_ID, { resolution: cancelledResolution })],
      );
      const { prisma, findMany } = client({
        firstPage: [newer, older],
        laterPage: [older],
      });

      const first = await queryLeadOpenWorkPage(
        prisma,
        TARGET_REPORT_ID,
        AUTHOR_ID,
        { limit: 1 },
      );
      expect(first).toMatchObject({
        occurrences: [
          {
            source: "published",
            reportId: newerReportId,
            reportSectionId: NEWER_SECTION_ID,
            parent: {
              kind: "product",
              id: OWNED_PROJECT,
              name: "Frozen Platform",
            },
            item: {
              id: NEWER_ITEM_ID,
              stableId: STABLE_ID,
              workflowStatus: "done",
            },
          },
        ],
      });
      expect(JSON.stringify(first)).not.toContain("Private item");
      expect(first?.nextCursor).not.toBeNull();
      expect(findMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          periodStart: { lt: new Date("2026-09-01T00:00:00.000Z") },
        },
        orderBy: [
          { periodStart: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 2,
      });

      const second = await queryLeadOpenWorkPage(
        prisma,
        TARGET_REPORT_ID,
        AUTHOR_ID,
        { cursor: first?.nextCursor ?? undefined, limit: 1 },
      );
      expect(second).toMatchObject({
        occurrences: [
          {
            reportId: OLDER_REPORT_ID,
            item: {
              id: OLDER_ITEM_ID,
              stableId: STABLE_ID,
              resolution: { kind: "wont_do" },
            },
          },
        ],
        nextCursor: null,
      });
      expect(findMany.mock.calls[1]?.[0].where?.OR).toHaveLength(3);
      expect(findMany.mock.calls[1]?.[0].take).toBe(2);
    },
  );

  it("reads only the author's submitted section when no snapshot exists", async () => {
    const historical = {
      id: NEWER_REPORT_ID,
      periodStart: new Date("2026-08-17T00:00:00.000Z"),
      periodEnd: new Date("2026-08-23T00:00:00.000Z"),
      createdAt: new Date("2026-08-17T10:00:00.000Z"),
      status: "draft" as const,
      periodStatus: "open" as const,
      publishedSnapshot: null,
      publishedSectionScopes: [],
    };
    const ownSection = baseRow({
      reportId: NEWER_REPORT_ID,
      status: "submitted",
      submittedAt: new Date("2026-08-20T12:00:00.000Z"),
      items: [
        fullItem({
          id: NEWER_ITEM_ID,
          projectId: OWNED_PROJECT,
          project: { name: "Owned" },
          stageNames: ["Development"],
          workflowStatus: "done",
        }),
      ],
    });
    const { prisma, findFirst } = client({
      firstPage: [historical],
      liveSection: ownSection,
    });

    const result = await queryLeadOpenWorkPage(
      prisma,
      TARGET_REPORT_ID,
      AUTHOR_ID,
      { limit: 10 },
    );

    expect(result?.occurrences[0]).toMatchObject({
      source: "submitted",
      reportId: NEWER_REPORT_ID,
      parent: {
        kind: "product",
        id: OWNED_PROJECT,
        name: "Owned Project",
      },
      item: { id: NEWER_ITEM_ID, workflowStatus: "done" },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reportId: NEWER_REPORT_ID,
          authorId: AUTHOR_ID,
          status: "submitted",
        },
      }),
    );
  });

  it("advances the report cursor when a page has no eligible section", async () => {
    const empty = {
      id: NEWER_REPORT_ID,
      periodStart: new Date("2026-08-17T00:00:00.000Z"),
      periodEnd: new Date("2026-08-23T00:00:00.000Z"),
      createdAt: new Date("2026-08-17T10:00:00.000Z"),
      status: "draft" as const,
      periodStatus: "open" as const,
      publishedSnapshot: null,
      publishedSectionScopes: [],
    };
    const probe = { ...empty, id: OLDER_REPORT_ID };
    const { prisma } = client({ firstPage: [empty, probe] });

    const result = await queryLeadOpenWorkPage(
      prisma,
      TARGET_REPORT_ID,
      AUTHOR_ID,
      { limit: 1 },
    );

    expect(result).toMatchObject({ occurrences: [] });
    expect(result?.nextCursor).not.toBeNull();
  });

  it("fails the whole page on a malformed frozen snapshot without live fallback", async () => {
    const malformed = {
      ...reportRow(
        NEWER_REPORT_ID,
        NEWER_SECTION_ID,
        "2026-08-17T00:00:00.000Z",
        [],
      ),
      publishedSnapshot: { reportId: NEWER_REPORT_ID },
    };
    const { prisma, findFirst } = client({
      firstPage: [malformed],
      liveSection: baseRow({ status: "submitted" }),
    });

    await expect(
      queryLeadOpenWorkPage(prisma, TARGET_REPORT_ID, AUTHOR_ID, {
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("fails when the frozen author scope names a different section", async () => {
    const mismatchedScope = {
      ...reportRow(
        NEWER_REPORT_ID,
        NEWER_SECTION_ID,
        "2026-08-17T00:00:00.000Z",
        [item(NEWER_ITEM_ID)],
      ),
      publishedSectionScopes: [
        {
          authorId: AUTHOR_ID,
          reportSectionId: OTHER_SECTION_ID,
          groupId: GROUP_ID,
        },
      ],
    };
    const { prisma } = client({ firstPage: [mismatchedScope] });

    await expect(
      queryLeadOpenWorkPage(prisma, TARGET_REPORT_ID, AUTHOR_ID, {
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
  });

  it("fails published lifecycle rows whose required snapshot is absent", async () => {
    const missing = {
      ...reportRow(
        NEWER_REPORT_ID,
        NEWER_SECTION_ID,
        "2026-08-17T00:00:00.000Z",
        [],
      ),
      publishedSnapshot: null,
    };
    const { prisma, findFirst } = client({ firstPage: [missing] });

    await expect(
      queryLeadOpenWorkPage(prisma, TARGET_REPORT_ID, AUTHOR_ID, {
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("skips a snapshot-less published report that has no frozen author scope", async () => {
    const unrelated = {
      ...reportRow(
        NEWER_REPORT_ID,
        NEWER_SECTION_ID,
        "2026-08-17T00:00:00.000Z",
        [],
      ),
      publishedSnapshot: null,
      publishedSectionScopes: [],
    };
    const { prisma, findFirst } = client({ firstPage: [unrelated] });

    await expect(
      queryLeadOpenWorkPage(prisma, TARGET_REPORT_ID, AUTHOR_ID, {
        limit: 10,
      }),
    ).resolves.toEqual({ occurrences: [], nextCursor: null });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects malformed cursors before querying historical reports", async () => {
    const { prisma, findMany } = client({ firstPage: [] });

    expect(() => decodeOpenWorkCursor("not-a-cursor")).toThrow(
      "Invalid open-work cursor.",
    );
    await expect(
      queryLeadOpenWorkPage(prisma, TARGET_REPORT_ID, AUTHOR_ID, {
        cursor: "not-a-cursor",
        limit: 10,
      }),
    ).rejects.toThrow("Invalid open-work cursor.");
    expect(findMany).not.toHaveBeenCalled();
  });
});
