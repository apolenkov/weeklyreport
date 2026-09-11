import {
  leadStatusOverviewPredecessorSchema,
  publishedReportSnapshotSchema,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  baseRow,
  fullItem,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness.js";
import { getStatusOverviewPeriodsRead } from "./lead-form-status-overview.read.js";

const CURRENT_REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PREVIOUS_REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_ID = AUTHOR_ID;
const HEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROUP_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_GROUP_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FOREIGN_AUTHOR_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const VIEWER_SECTION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PAUSED_ITEM_ID = "99999999-9999-4999-8999-999999999999";
const STAGE_ID = "88888888-8888-4888-8888-888888888881";

const current = {
  id: CURRENT_REPORT_ID,
  periodStart: new Date("2026-08-24T00:00:00.000Z"),
  periodEnd: new Date("2026-08-30T23:59:59.999Z"),
};

function publishedProject() {
  const stage = {
    stageId: STAGE_ID,
    stageName: "Development",
    sortOrder: 1,
    status: "green" as const,
  };
  return {
    projectId: OWNED_PROJECT,
    projectName: "Shared product",
    trafficLight: "green" as const,
    ownedStages: [stage],
    stageSet: [stage],
    ownerGroupId: null,
  };
}

function publishedSection(
  options: {
    authorId?: string;
    reportSectionId?: string;
    pausedItem?: boolean;
    sharedProject?: boolean;
  } = {},
) {
  return {
    reportSectionId: options.reportSectionId ?? SECTION_ID,
    reportId: PREVIOUS_REPORT_ID,
    authorId: options.authorId ?? AUTHOR_ID,
    authorName: "Lead One",
    authorRole: "lead" as const,
    version: 1,
    status: "submitted" as const,
    submittedAt: new Date("2026-08-23T12:00:00.000Z"),
    late: false,
    projects: options.sharedProject ? [publishedProject()] : [],
    referencedProjects: [],
    items: options.pausedItem
      ? [
          {
            id: PAUSED_ITEM_ID,
            stableId: PAUSED_ITEM_ID,
            projectId: OWNED_PROJECT,
            type: "current" as const,
            text: "Paused published work",
            tag: "feature",
            workflowStatus: "paused" as const,
            pausedReason: "Confidential published dependency",
            carriedOver: false,
            priorityRank: null,
            stageNames: ["Development"],
          },
        ]
      : [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: GROUP_ID,
    groupName: "Delivery",
  };
}

function snapshot(sections = [publishedSection()]) {
  return publishedReportSnapshotSchema.parse({
    reportId: PREVIOUS_REPORT_ID,
    periodStart: new Date("2026-08-17T00:00:00.000Z"),
    periodEnd: new Date("2026-08-23T23:59:59.999Z"),
    deadline: null,
    status: "published",
    publishedAt: new Date("2026-08-24T08:00:00.000Z"),
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections,
  });
}

function predecessor(
  overrides: Partial<{
    publishedSnapshot: unknown;
    publishedSectionScopes: readonly {
      authorId: string;
      reportSectionId: string;
      groupId: string;
    }[];
  }> = {},
) {
  return {
    id: PREVIOUS_REPORT_ID,
    periodStart: new Date("2026-08-17T00:00:00.000Z"),
    periodEnd: new Date("2026-08-23T23:59:59.999Z"),
    publishedSnapshot: null,
    publishedSectionScopes: [],
    ...overrides,
  };
}

function reader(options: {
  previous: ReturnType<typeof predecessor> | null;
  liveSection?: ReturnType<typeof baseRow> | null;
  reportingGroupId?: string | null;
  sharedProjectId?: string;
  viewerSectionExists?: boolean;
}) {
  const reportFindUnique = vi.fn().mockResolvedValue(current);
  const reportFindFirst = vi.fn().mockResolvedValue(options.previous);
  const sectionFindFirst = vi
    .fn()
    .mockResolvedValue(options.liveSection ?? null);
  const sectionFindUnique = vi
    .fn()
    .mockResolvedValue(options.viewerSectionExists ? { id: SECTION_ID } : null);
  const userFindUnique = vi.fn().mockResolvedValue({
    reportingGroupId: options.reportingGroupId ?? null,
  });
  let transactionOptions: unknown;
  const tx = {
    report: { findUnique: reportFindUnique, findFirst: reportFindFirst },
    reportSection: {
      findFirst: sectionFindFirst,
      findUnique: sectionFindUnique,
    },
    user: { findUnique: userFindUnique },
    stageAssignment: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          options.sharedProjectId === undefined
            ? []
            : [{ projectId: options.sharedProjectId }],
        ),
    },
  };
  const prisma = {
    $transaction: async (
      operation: (client: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return operation(tx);
    },
  } as never;
  return {
    prisma,
    reportFindFirst,
    sectionFindFirst,
    transactionOptions: () => transactionOptions,
  };
}

describe("getStatusOverviewPeriodsRead", () => {
  it("uses an admitted valid snapshot before mutable live rows", async () => {
    const { prisma, sectionFindFirst, transactionOptions } = reader({
      previous: predecessor({
        publishedSnapshot: snapshot(),
        publishedSectionScopes: [
          {
            authorId: AUTHOR_ID,
            reportSectionId: SECTION_ID,
            groupId: GROUP_ID,
          },
        ],
      }),
      liveSection: baseRow({ status: "submitted" }),
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(result?.predecessor).toMatchObject({
      availability: "available",
      source: "published",
      reportId: PREVIOUS_REPORT_ID,
    });
    expect(sectionFindFirst).not.toHaveBeenCalled();
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  it("returns a redacted paused item from a shared published predecessor", async () => {
    const publishedViewer = publishedSection({
      authorId: VIEWER_ID,
      reportSectionId: VIEWER_SECTION_ID,
      sharedProject: true,
    });
    const publishedForeign = publishedSection({
      authorId: FOREIGN_AUTHOR_ID,
      pausedItem: true,
      sharedProject: true,
    });
    const { prisma } = reader({
      previous: predecessor({
        publishedSnapshot: snapshot([publishedViewer, publishedForeign]),
        publishedSectionScopes: [
          {
            authorId: VIEWER_ID,
            reportSectionId: VIEWER_SECTION_ID,
            groupId: GROUP_ID,
          },
          {
            authorId: FOREIGN_AUTHOR_ID,
            reportSectionId: SECTION_ID,
            groupId: GROUP_ID,
          },
        ],
      }),
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      FOREIGN_AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(
      leadStatusOverviewPredecessorSchema.safeParse(result?.predecessor)
        .success,
    ).toBe(true);
    expect(result?.predecessor).toMatchObject({
      availability: "available",
      source: "published",
    });
    if (result?.predecessor.availability !== "available") {
      throw new Error("Expected an available published predecessor.");
    }
    expect(result.predecessor.section.items[0]).toMatchObject({
      workflowStatus: "paused",
    });
    expect(result.predecessor.section.items[0]).not.toHaveProperty(
      "pausedReason",
    );
  });

  it("falls back only to a submitted live section when no snapshot exists", async () => {
    const live = baseRow({
      status: "submitted",
      submittedAt: new Date("2026-08-23T12:00:00.000Z"),
    });
    const { prisma, sectionFindFirst } = reader({
      previous: predecessor(),
      liveSection: live,
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(result?.predecessor).toMatchObject({
      availability: "available",
      source: "submitted",
      section: { status: "submitted", authorId: AUTHOR_ID },
    });
    const firstCall = sectionFindFirst.mock.calls[0] as unknown[] | undefined;
    const input = firstCall?.[0] as
      { readonly where?: { readonly status?: unknown } } | undefined;
    expect(input?.where?.status).toBe("submitted");
  });

  it("returns a redacted paused item from a shared submitted predecessor", async () => {
    const liveSection = baseRow({
      authorId: FOREIGN_AUTHOR_ID,
      status: "submitted",
      submittedAt: new Date("2026-08-23T12:00:00.000Z"),
      items: [
        fullItem({
          id: PAUSED_ITEM_ID,
          projectId: OWNED_PROJECT,
          workflowStatus: "paused",
          pausedReason: "Confidential live dependency",
          stageNames: ["Development"],
          project: { name: "Shared product" },
        }),
      ],
    });
    const { prisma } = reader({
      previous: predecessor(),
      liveSection,
      sharedProjectId: OWNED_PROJECT,
      viewerSectionExists: true,
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      FOREIGN_AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(
      leadStatusOverviewPredecessorSchema.safeParse(result?.predecessor)
        .success,
    ).toBe(true);
    expect(result?.predecessor).toMatchObject({
      availability: "available",
      source: "submitted",
    });
    if (result?.predecessor.availability !== "available") {
      throw new Error("Expected an available submitted predecessor.");
    }
    expect(result.predecessor.section.items[0]).toMatchObject({
      workflowStatus: "paused",
    });
    expect(result.predecessor.section.items[0]).not.toHaveProperty(
      "pausedReason",
    );
  });

  it("returns unavailable when the immediate predecessor has only a draft", async () => {
    const { prisma, sectionFindFirst } = reader({
      previous: predecessor(),
      // The repository query excludes this row through status='submitted'.
      liveSection: null,
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(result?.predecessor).toMatchObject({
      availability: "unavailable",
      reason: "section_unavailable",
    });
    expect(sectionFindFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "submitted" },
    });
  });

  it("does not fall through a malformed snapshot to mutable content", async () => {
    const { prisma, sectionFindFirst } = reader({
      previous: predecessor({
        publishedSnapshot: { reportId: PREVIOUS_REPORT_ID },
        publishedSectionScopes: [
          {
            authorId: AUTHOR_ID,
            reportSectionId: SECTION_ID,
            groupId: GROUP_ID,
          },
        ],
      }),
      liveSection: baseRow({ status: "submitted" }),
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(result?.predecessor).toMatchObject({
      availability: "unavailable",
      reason: "invalid_published_snapshot",
    });
    expect(sectionFindFirst).not.toHaveBeenCalled();
  });

  it("does not expose a predecessor outside a head's frozen group scope", async () => {
    const { prisma, sectionFindFirst } = reader({
      previous: predecessor({
        publishedSnapshot: snapshot(),
        publishedSectionScopes: [
          {
            authorId: AUTHOR_ID,
            reportSectionId: SECTION_ID,
            groupId: OTHER_GROUP_ID,
          },
        ],
      }),
      reportingGroupId: GROUP_ID,
    });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      HEAD_ID,
      "head",
    );

    expect(result?.predecessor).toMatchObject({
      availability: "unavailable",
      reason: "section_unavailable",
    });
    expect(JSON.stringify(result)).not.toContain("Lead One");
    expect(sectionFindFirst).not.toHaveBeenCalled();
  });

  it("returns an explicit no-predecessor state after one bounded lookup", async () => {
    const { prisma, reportFindFirst } = reader({ previous: null });

    const result = await getStatusOverviewPeriodsRead(
      prisma,
      CURRENT_REPORT_ID,
      AUTHOR_ID,
      VIEWER_ID,
      "lead",
    );

    expect(result?.predecessor).toEqual({
      availability: "unavailable",
      reason: "no_predecessor",
    });
    expect(reportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodStart: { lt: current.periodStart } },
        orderBy: [
          { periodStart: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
      }),
    );
  });
});
