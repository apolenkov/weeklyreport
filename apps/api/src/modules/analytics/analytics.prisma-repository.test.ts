import type { TrafficLightCell, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PublishedSnapshotIntegrityError } from "../report-sections/index.js";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository.js";

const REPORT_A = "10000000-0000-4000-8000-000000000001";
const REPORT_B = "10000000-0000-4000-8000-000000000002";
const SECTION_A = "20000000-0000-4000-8000-000000000001";
const SECTION_B = "20000000-0000-4000-8000-000000000002";
const LEAD_A = "30000000-0000-4000-8000-000000000001";
const LEAD_B = "30000000-0000-4000-8000-000000000002";
const GROUP_A = "40000000-0000-4000-8000-000000000001";
const GROUP_B = "40000000-0000-4000-8000-000000000002";
const PROJECT_A = "60000000-0000-4000-8000-000000000001";
const PROJECT_B = "60000000-0000-4000-8000-000000000002";

const headA: UserSession = {
  userId: "50000000-0000-4000-8000-000000000001",
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: GROUP_A,
};
const adminSession: UserSession = { ...headA, role: "admin" };
const emptyViewer: UserSession = {
  ...headA,
  role: "viewer",
  reportingGroupId: undefined,
  viewerGroupAccess: [],
};

const HISTORY_INPUT = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

interface SnapshotSectionInput {
  readonly sectionId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly groupId: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly status?: TrafficLightCell;
  readonly submitted?: boolean;
  readonly late?: boolean;
}

function snapshotSection(reportId: string, input: SnapshotSectionInput) {
  return {
    reportSectionId: input.sectionId,
    reportId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: "lead",
    version: 1,
    status: input.submitted === false ? "draft" : "submitted",
    submittedAt: input.submitted === false ? null : "2026-04-20T12:00:00.000Z",
    late: input.late ?? false,
    projects:
      input.projectId === undefined
        ? []
        : [
            {
              projectId: input.projectId,
              projectName: input.projectName ?? "Project",
              trafficLight: input.status ?? null,
              ownedStages: [],
              stageSet: [],
              ownerGroupId: input.groupId,
            },
          ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: input.groupId,
    groupName: `Group ${input.groupId.at(-1) ?? "?"}`,
  };
}

function publishedRow(args: {
  reportId: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
  publishedAt?: string;
  sections: readonly SnapshotSectionInput[];
}) {
  const periodEnd = args.periodEnd ?? "2026-04-21T12:00:00.000Z";
  return {
    id: args.reportId,
    periodEnd: new Date(periodEnd),
    createdAt: new Date(args.createdAt ?? "2026-04-22T12:00:00.000Z"),
    publishedSnapshot: {
      reportId: args.reportId,
      periodStart: args.periodStart ?? "2026-04-15T00:00:00.000Z",
      periodEnd,
      deadline: "2026-04-20T00:00:00.000Z",
      status: "published",
      publishedAt: args.publishedAt ?? "2026-04-21T13:00:00.000Z",
      publishedById: null,
      publishedByName: null,
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: args.sections.map((section) =>
        snapshotSection(args.reportId, section),
      ),
    },
  };
}

function repositoryForRows(rows: readonly ReturnType<typeof publishedRow>[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { report: { findMany } } as unknown as PrismaService;
  return { repo: new AnalyticsPrismaRepository(prisma), findMany };
}

const sectionA: SnapshotSectionInput = {
  sectionId: SECTION_A,
  authorId: LEAD_A,
  authorName: "Lead A",
  groupId: GROUP_A,
  projectId: PROJECT_A,
  projectName: "Project A",
  status: "green",
};
const sectionB: SnapshotSectionInput = {
  sectionId: SECTION_B,
  authorId: LEAD_B,
  authorName: "Lead B",
  groupId: GROUP_B,
  projectId: PROJECT_B,
  projectName: "Project B",
  status: "red",
};

const groupRows = [
  publishedRow({
    reportId: REPORT_A,
    sections: [sectionA, sectionB],
  }),
];

describe("AnalyticsPrismaRepository frozen snapshot scoping", () => {
  it("scopes history from frozen ownership without querying live sections", async () => {
    const { repo, findMany } = repositoryForRows(groupRows);

    const result = await repo.trafficLightHistory(HISTORY_INPUT, headA);

    expect(result.rows.map((row) => row.projectId)).toEqual([PROJECT_A]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        publishedSectionScopes: {
          some: { groupId: { in: [GROUP_A] } },
        },
      },
      select: {
        id: true,
        periodEnd: true,
        createdAt: true,
        publishedSnapshot: true,
      },
    });
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("include");
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("where.sections");
  });

  it("filters a lead's frozen sections after group-scoped report admission", async () => {
    const { repo, findMany } = repositoryForRows(groupRows);

    const result = await repo.trafficLightHistory(
      { ...HISTORY_INPUT, leadId: LEAD_A },
      headA,
    );

    expect(result.rows.map((row) => row.projectId)).toEqual([PROJECT_A]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        publishedSectionScopes: {
          some: {
            groupId: { in: [GROUP_A] },
          },
        },
      },
    });
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty(
      "where.publishedSectionScopes.some.authorId",
    );
  });

  it("returns both frozen groups to an admin", async () => {
    const { repo } = repositoryForRows(groupRows);

    const result = await repo.trafficLightHistory(HISTORY_INPUT, adminSession);

    expect(result.rows.map((row) => row.projectId)).toEqual([
      PROJECT_A,
      PROJECT_B,
    ]);
  });

  it("collapses an empty-access viewer to no analytics facts", async () => {
    const { repo, findMany } = repositoryForRows([]);

    await expect(
      repo.trafficLightHistory(HISTORY_INPUT, emptyViewer),
    ).resolves.toEqual({ periods: [], rows: [] });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        publishedSectionScopes: {
          some: { reportId: { in: [] } },
        },
      },
    });
  });

  it("fails closed when a settled row has a malformed snapshot", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ ...groupRows[0], publishedSnapshot: {} }]);
    const repo = new AnalyticsPrismaRepository({
      report: { findMany },
    } as unknown as PrismaService);

    await expect(
      repo.trafficLightHistory(HISTORY_INPUT, headA),
    ).rejects.toThrow("Published snapshot integrity failure");
  });

  it("throws before querying when the session is missing", async () => {
    const { repo, findMany } = repositoryForRows(groupRows);

    await expect(
      repo.trafficLightHistory(
        HISTORY_INPUT,
        undefined as unknown as UserSession,
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
});

async function comparisonFor(
  rowsA: readonly ReturnType<typeof publishedRow>[],
  rowsB: readonly ReturnType<typeof publishedRow>[] = [],
  periodA = "2026-04-21",
) {
  const findMany = vi
    .fn()
    .mockResolvedValueOnce(rowsA)
    .mockResolvedValueOnce(rowsB);
  const repo = new AnalyticsPrismaRepository({
    report: { findMany },
  } as unknown as PrismaService);
  return repo.periodComparison(
    { periodA, periodB: "2026-04-28" },
    adminSession,
  );
}

async function statusAFor(
  rows: readonly ReturnType<typeof publishedRow>[],
): Promise<TrafficLightCell> {
  const out = await comparisonFor(rows);
  return out.rows.find((row) => row.projectId === PROJECT_A)?.statusA ?? null;
}

describe("AnalyticsPrismaRepository deterministic tie-break", () => {
  it("selects the same id-ordered snapshot status regardless of row order", async () => {
    const stamp = "2026-04-21T12:00:00.000Z";
    const created = "2026-04-22T12:00:00.000Z";
    const low = publishedRow({
      reportId: REPORT_A,
      periodEnd: stamp,
      createdAt: created,
      sections: [
        {
          sectionId: SECTION_A,
          authorId: LEAD_A,
          authorName: "Lead A",
          groupId: GROUP_A,
          projectId: PROJECT_A,
          status: "green",
        },
      ],
    });
    const high = publishedRow({
      reportId: REPORT_B,
      periodEnd: stamp,
      createdAt: created,
      sections: [
        {
          sectionId: SECTION_B,
          authorId: LEAD_B,
          authorName: "Lead B",
          groupId: GROUP_B,
          projectId: PROJECT_A,
          status: "red",
        },
      ],
    });

    await expect(statusAFor([low, high])).resolves.toBe("red");
    await expect(statusAFor([high, low])).resolves.toBe("red");
  });
});

describe("AnalyticsPrismaRepository lead velocity", () => {
  it("uses only the latest publication's leads for a period label", async () => {
    const first = publishedRow({
      reportId: REPORT_A,
      periodEnd: "2026-04-21T08:00:00.000Z",
      sections: [
        {
          sectionId: SECTION_A,
          authorId: LEAD_A,
          authorName: "Lead A",
          groupId: GROUP_A,
        },
      ],
    });
    const second = publishedRow({
      reportId: REPORT_B,
      periodEnd: "2026-04-21T20:00:00.000Z",
      publishedAt: "2026-04-22T12:00:00.000Z",
      sections: [
        {
          sectionId: SECTION_B,
          authorId: LEAD_B,
          authorName: "Lead B",
          groupId: GROUP_B,
        },
      ],
    });
    const { repo } = repositoryForRows([first, second]);

    const out = await repo.leadVelocity(HISTORY_INPUT, adminSession);

    expect(out).toHaveLength(1);
    expect(out[0]?.periodEnd).toBe("2026-04-21");
    expect(out[0]?.leads.map((lead) => lead.leadId)).toEqual([LEAD_B]);
  });

  it("keeps zero leads when a newer draft replaces an older submission", async () => {
    const older = publishedRow({
      reportId: REPORT_A,
      sections: [sectionA],
    });
    const newer = publishedRow({
      reportId: REPORT_B,
      publishedAt: "2026-04-22T12:00:00.000Z",
      sections: [
        { ...sectionA, authorName: "Lead A at publication", submitted: false },
        { ...sectionB, submitted: false },
      ],
    });
    const { repo } = repositoryForRows([older, newer]);

    await expect(
      repo.leadVelocity(HISTORY_INPUT, adminSession),
    ).resolves.toEqual([
      {
        periodStart: "2026-04-15",
        periodEnd: "2026-04-21",
        leads: [
          {
            leadId: LEAD_A,
            leadName: "Lead A at publication",
            submittedSections: 0,
          },
          { leadId: LEAD_B, leadName: "Lead B", submittedSections: 0 },
        ],
      },
    ]);
  });
});

describe("AnalyticsPrismaRepository authoritative publication", () => {
  it.each([false, true])(
    "uses publication order across all queries despite creation and periodEnd order (reverse=%s)",
    async (reverse) => {
      const earlierPublication = publishedRow({
        reportId: REPORT_B,
        periodEnd: "2026-04-21T20:00:00.000Z",
        createdAt: "2026-04-22T12:00:00.000Z",
        publishedAt: "2026-04-21T21:00:00.000Z",
        sections: [sectionA],
      });
      const laterPublication = publishedRow({
        reportId: REPORT_A,
        periodEnd: "2026-04-21T08:00:00.000Z",
        createdAt: "2026-04-20T12:00:00.000Z",
        publishedAt: "2026-04-23T12:00:00.000Z",
        sections: [
          { ...sectionB, projectId: PROJECT_A, projectName: "Latest" },
        ],
      });
      const rows = reverse
        ? [laterPublication, earlierPublication]
        : [earlierPublication, laterPublication];
      const { repo } = repositoryForRows(rows);

      const history = await repo.trafficLightHistory(
        HISTORY_INPUT,
        adminSession,
      );
      const comparison = await comparisonFor(rows);
      const velocity = await repo.leadVelocity(HISTORY_INPUT, adminSession);

      expect.soft(history).toEqual({
        periods: [{ periodStart: "2026-04-15", periodEnd: "2026-04-21" }],
        rows: [
          { projectId: PROJECT_A, projectName: "Latest", statuses: ["red"] },
        ],
      });
      expect.soft(comparison.rows[0]).toMatchObject({
        projectId: PROJECT_A,
        projectName: "Latest",
        statusA: "red",
      });
      expect(velocity).toEqual([
        {
          periodStart: "2026-04-15",
          periodEnd: "2026-04-21",
          leads: [{ leadId: LEAD_B, leadName: "Lead B", submittedSections: 1 }],
        },
      ]);
    },
  );

  it("preserves a winner's null project status and frozen name", async () => {
    const older = publishedRow({ reportId: REPORT_A, sections: [sectionA] });
    const newer = publishedRow({
      reportId: REPORT_B,
      publishedAt: "2026-04-22T12:00:00.000Z",
      sections: [{ ...sectionA, projectName: "Latest null", status: null }],
    });
    const rows = [older, newer];
    const { repo } = repositoryForRows(rows);

    const history = await repo.trafficLightHistory(HISTORY_INPUT, adminSession);
    const comparison = await comparisonFor(rows);

    expect
      .soft(history.rows)
      .toEqual([
        { projectId: PROJECT_A, projectName: "Latest null", statuses: [null] },
      ]);
    expect(comparison.rows[0]).toMatchObject({
      projectId: PROJECT_A,
      projectName: "Latest null",
      statusA: null,
    });
  });

  it("collects project membership only from the winning publication", async () => {
    const older = publishedRow({ reportId: REPORT_A, sections: [sectionA] });
    const newer = publishedRow({
      reportId: REPORT_B,
      publishedAt: "2026-04-22T12:00:00.000Z",
      sections: [sectionB],
    });
    const { repo } = repositoryForRows([older, newer]);

    await expect(
      repo.trafficLightHistory(HISTORY_INPUT, adminSession),
    ).resolves.toEqual({
      periods: [{ periodStart: "2026-04-15", periodEnd: "2026-04-21" }],
      rows: [
        { projectId: PROJECT_B, projectName: "Project B", statuses: ["red"] },
      ],
    });
  });

  it("returns null when the winner lacks a project still present in another period", async () => {
    const older = publishedRow({ reportId: REPORT_A, sections: [sectionA] });
    const newer = publishedRow({
      reportId: REPORT_B,
      publishedAt: "2026-04-22T12:00:00.000Z",
      sections: [sectionB],
    });
    const nextPeriod = publishedRow({
      reportId: "10000000-0000-4000-8000-000000000003",
      periodEnd: "2026-04-28T12:00:00.000Z",
      publishedAt: "2026-04-28T13:00:00.000Z",
      sections: [{ ...sectionA, projectName: "Next name", status: "yellow" }],
    });
    const { repo } = repositoryForRows([older, newer, nextPeriod]);

    const history = await repo.trafficLightHistory(HISTORY_INPUT, adminSession);
    const comparison = await comparisonFor([older, newer], [nextPeriod]);

    expect
      .soft(history.rows.find((row) => row.projectId === PROJECT_A))
      .toEqual({
        projectId: PROJECT_A,
        projectName: "Next name",
        statuses: [null, "yellow"],
      });
    expect(
      comparison.rows.find((row) => row.projectId === PROJECT_A),
    ).toMatchObject({
      statusA: null,
      statusB: "yellow",
    });
  });

  it("does not fall back to an older report when the winner lacks the requested lead", async () => {
    const rows = [
      publishedRow({ reportId: REPORT_A, sections: [sectionA] }),
      publishedRow({
        reportId: REPORT_B,
        publishedAt: "2026-04-22T12:00:00.000Z",
        sections: [{ ...sectionB, groupId: GROUP_A }],
      }),
    ];
    const findMany = vi.fn(
      (query: {
        where: { publishedSectionScopes?: { some?: { authorId?: string } } };
      }) => {
        const leadId = query.where.publishedSectionScopes?.some?.authorId;
        return Promise.resolve(
          rows.filter(
            (row) =>
              leadId === undefined ||
              row.publishedSnapshot.sections.some(
                (section) => section.authorId === leadId,
              ),
          ),
        );
      },
    );
    const repo = new AnalyticsPrismaRepository({
      report: { findMany },
    } as unknown as PrismaService);

    await expect(
      repo.trafficLightHistory({ ...HISTORY_INPUT, leadId: LEAD_A }, headA),
    ).resolves.toEqual({
      periods: [{ periodStart: "2026-04-15", periodEnd: "2026-04-21" }],
      rows: [],
    });
  });
});

describe("AnalyticsPrismaRepository frozen period metadata", () => {
  it.each([false, true])(
    "takes dates and cells from the same publication despite live date drift (reverse=%s)",
    async (reverse) => {
      const older = publishedRow({
        reportId: REPORT_A,
        periodStart: "2026-04-15T00:00:00.000Z",
        sections: [sectionA],
      });
      const winner = publishedRow({
        reportId: REPORT_B,
        periodStart: "2026-04-01T18:00:00.000Z",
        periodEnd: "2026-04-21T20:00:00.000Z",
        publishedAt: "2026-04-22T12:00:00.000Z",
        sections: [{ ...sectionB, projectId: PROJECT_A }],
      });
      const liveDates = {
        periodStart: new Date("2026-04-20T00:00:00.000Z"),
        periodEnd: new Date("2026-04-23T12:00:00.000Z"),
      };
      const drifted = { ...winner, ...liveDates };
      const admittedOlder = { ...older, ...liveDates };
      const rows = reverse
        ? [drifted, admittedOlder]
        : [admittedOlder, drifted];
      const { repo } = repositoryForRows(rows);
      const history = await repo.trafficLightHistory(
        HISTORY_INPUT,
        adminSession,
      );
      const submissions = await repo.leadVelocity(HISTORY_INPUT, adminSession);
      const comparison = await comparisonFor(rows, [], "2026-04-23");
      expect(history.periods).toEqual([
        { periodStart: "2026-04-01", periodEnd: "2026-04-21" },
      ]);
      expect(history.rows[0]?.statuses).toEqual(["red"]);
      expect(submissions[0]).toMatchObject({
        periodStart: "2026-04-01",
        periodEnd: "2026-04-21",
        leads: [{ leadId: LEAD_B }],
      });
      expect(comparison).toMatchObject({
        periodA: { periodStart: "2026-04-01", periodEnd: "2026-04-21" },
        periodB: null,
        rows: [{ statusA: "red", statusB: null }],
      });
    },
  );
  it.each([false, true])(
    "rejects multiple frozen end-day groups in one comparison side (reverse=%s)",
    async (reverse) => {
      const first = publishedRow({ reportId: REPORT_A, sections: [sectionA] });
      const second = publishedRow({
        reportId: REPORT_B,
        periodEnd: "2026-04-22T00:00:00.000Z",
        sections: [sectionB],
      });
      const rows = reverse ? [second, first] : [first, second];
      await expect(comparisonFor(rows)).rejects.toThrow(
        PublishedSnapshotIntegrityError,
      );
      await expect(comparisonFor([], rows)).rejects.toThrow(
        PublishedSnapshotIntegrityError,
      );
    },
  );
  it("returns null metadata and empty cells for missing comparison sides", async () => {
    await expect(comparisonFor([])).resolves.toEqual({
      periodA: null,
      periodB: null,
      rows: [],
    });
  });
});
