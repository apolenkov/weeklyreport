import type {
  TrafficLightCell,
  TrafficLightStatus,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
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
  readonly status?: TrafficLightStatus;
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
  periodEnd?: string;
  createdAt?: string;
  sections: readonly SnapshotSectionInput[];
}) {
  const periodEnd = args.periodEnd ?? "2026-04-21T12:00:00.000Z";
  return {
    id: args.reportId,
    periodEnd: new Date(periodEnd),
    createdAt: new Date(args.createdAt ?? "2026-04-22T12:00:00.000Z"),
    publishedSnapshot: {
      reportId: args.reportId,
      periodStart: "2026-04-15T00:00:00.000Z",
      periodEnd,
      deadline: "2026-04-20T00:00:00.000Z",
      status: "published",
      publishedAt: "2026-04-21T13:00:00.000Z",
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

const groupRows = [
  publishedRow({
    reportId: REPORT_A,
    sections: [
      {
        sectionId: SECTION_A,
        authorId: LEAD_A,
        authorName: "Lead A",
        groupId: GROUP_A,
        projectId: PROJECT_A,
        projectName: "Project A",
        status: "green",
      },
      {
        sectionId: SECTION_B,
        authorId: LEAD_B,
        authorName: "Lead B",
        groupId: GROUP_B,
        projectId: PROJECT_B,
        projectName: "Project B",
        status: "red",
      },
    ],
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

  it("applies leadId and group scope to the same frozen projection row", async () => {
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
            authorId: LEAD_A,
            groupId: { in: [GROUP_A] },
          },
        },
      },
    });
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

async function statusAFor(
  rows: readonly ReturnType<typeof publishedRow>[],
): Promise<TrafficLightCell> {
  const findMany = vi.fn().mockResolvedValueOnce(rows).mockResolvedValue([]);
  const repo = new AnalyticsPrismaRepository({
    report: { findMany },
  } as unknown as PrismaService);
  const out = await repo.periodComparison(
    { periodA: "2026-04-21", periodB: "2026-04-28" },
    adminSession,
  );
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
  it("collapses two snapshot reports sharing a period label into one row", async () => {
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
    expect(out[0]?.periodLabel).toBe("2026-04-21");
    expect(out[0]?.leads.map((lead) => lead.leadId)).toEqual([LEAD_A, LEAD_B]);
  });
});
