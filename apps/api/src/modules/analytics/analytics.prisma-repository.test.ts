import type { TrafficLightCell, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository";

// A Report is a unified period holding every group's sections, so a scope
// applied only top-level false-greens the integration test: these tests assert
// the group-scope fragment lands on the nested `include.sections.where`.

const GROUP = "a0000000-0000-4000-8000-0000000group-g";
const LEAD = "d0000000-0000-4000-8000-0000000000d1";
const SCOPE = { author: { reportingGroupId: { in: [GROUP] } } };

const headG: UserSession = {
  userId: "a0000000-0000-4000-8000-0000000000g1",
  email: "head-g@test.local",
  name: "Head G",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: GROUP,
};
const adminSession: UserSession = { ...headG, role: "admin" };
const emptyViewer: UserSession = {
  ...headG,
  role: "viewer",
  reportingGroupId: undefined,
  viewerGroupAccess: [],
};

const HISTORY_INPUT = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

interface ReportQueryArg {
  where: { sections?: unknown };
  include: { sections: { where?: unknown } };
}

function makeRepo() {
  // Typed param so vi records a one-element call-args tuple (a no-arg mock
  // infers `[]`, making `.mock.calls[0][0]` an out-of-bounds tuple access).
  const findMany = vi.fn((_query: unknown) => Promise.resolve([]));
  const prisma = {
    report: { findMany },
  } as unknown as PrismaService;
  return { repo: new AnalyticsPrismaRepository(prisma), findMany };
}

describe("AnalyticsPrismaRepository group scoping", () => {
  it("trafficLightHistory scopes the included sections for a non-admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.trafficLightHistory(HISTORY_INPUT, headG);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual(SCOPE);
    expect(arg.where.sections).toEqual({ some: SCOPE });
  });

  it("trafficLightHistory carries a leadId filter into the aggregated sections", async () => {
    const { repo, findMany } = makeRepo();
    // Admin session: no group scope, so the ONLY predicate is the lead filter —
    // it must reach include.sections.where (aggregation), not just the report
    // qualifier. Without the fix, include.sections.where stays undefined.
    await repo.trafficLightHistory(
      { ...HISTORY_INPUT, leadId: LEAD },
      adminSession,
    );

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({ authorId: LEAD });
    expect(arg.where.sections).toEqual({ some: { authorId: LEAD } });
  });

  it("trafficLightHistory combines a leadId filter with the group scope", async () => {
    const { repo, findMany } = makeRepo();
    await repo.trafficLightHistory({ ...HISTORY_INPUT, leadId: LEAD }, headG);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({ authorId: LEAD, ...SCOPE });
    expect(arg.where.sections).toEqual({ some: { authorId: LEAD, ...SCOPE } });
  });

  it("trafficLightHistory leaves the included sections unfiltered for admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.trafficLightHistory(HISTORY_INPUT, adminSession);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toBeUndefined();
    expect(arg.where.sections).toBeUndefined();
  });

  it("trafficLightHistory collapses an empty-access viewer to a zero-row scope", async () => {
    const { repo, findMany } = makeRepo();
    await repo.trafficLightHistory(HISTORY_INPUT, emptyViewer);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({ id: { in: [] } });
    expect(arg.where.sections).toEqual({ some: { id: { in: [] } } });
  });

  it("leadVelocity preserves the submitted filter and adds scope (non-admin)", async () => {
    const { repo, findMany } = makeRepo();
    await repo.leadVelocity(HISTORY_INPUT, headG);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({
      status: "submitted",
      author: { reportingGroupId: { in: [GROUP] } },
    });
    expect(arg.where.sections).toEqual({
      some: { status: "submitted", ...SCOPE },
    });
  });

  it("leadVelocity keeps only the submitted filter for admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.leadVelocity(HISTORY_INPUT, adminSession);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({ status: "submitted" });
    expect(arg.where.sections).toEqual({ some: { status: "submitted" } });
  });

  it("periodComparison scopes the included sections for a non-admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headG,
    );

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual(SCOPE);
    expect(arg.where.sections).toEqual({ some: SCOPE });
  });

  it("periodComparison leaves sections unfiltered for admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      adminSession,
    );

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toBeUndefined();
    expect(arg.where.sections).toBeUndefined();
  });

  it("throws via guardGroupScope when the session is missing (no query runs)", async () => {
    const { repo, findMany } = makeRepo();

    await expect(
      repo.trafficLightHistory(
        HISTORY_INPUT,
        undefined as unknown as UserSession,
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
});

// With an identical `periodEnd` AND `createdAt` the comparator resolves to 0
// and status selection would follow non-deterministic DB row order; the `id` is
// the final tie-break that makes the order total.
const TIE_PROJECT = "22222222-2222-4222-8222-222222222222";

interface FakeReport {
  id: string;
  periodEnd: Date;
  createdAt: Date;
  sections: {
    projectStatuses: {
      projectId: string;
      status: TrafficLightCell;
      project: { name: string };
    }[];
    risks: { projectId: string | null }[];
  }[];
}

function reportWithStatus(
  id: string,
  status: TrafficLightCell,
  stamp: Date,
): FakeReport {
  return {
    id,
    periodEnd: stamp,
    createdAt: stamp,
    sections: [
      {
        projectStatuses: [
          { projectId: TIE_PROJECT, status, project: { name: "P" } },
        ],
        risks: [],
      },
    ],
  };
}

async function statusAFor(sideA: FakeReport[]): Promise<TrafficLightCell> {
  const findMany = vi.fn();
  // periodComparison fetches periodA first, then periodB (empty here).
  findMany.mockResolvedValueOnce(sideA).mockResolvedValue([]);
  const prisma = { report: { findMany } } as unknown as PrismaService;
  const repo = new AnalyticsPrismaRepository(prisma);

  const out = await repo.periodComparison(
    { periodA: "2026-04-21", periodB: "2026-04-28" },
    adminSession,
  );
  return out.rows.find((r) => r.projectId === TIE_PROJECT)?.statusA ?? null;
}

describe("AnalyticsPrismaRepository deterministic tie-break", () => {
  it("selects an id-ordered status when two reports share periodEnd+createdAt", async () => {
    const stamp = new Date("2026-04-21T12:00:00.000Z");
    const low = reportWithStatus("report-aaaa", "green", stamp);
    const high = reportWithStatus("report-bbbb", "red", stamp);

    const forward = await statusAFor([low, high]);
    const reversed = await statusAFor([high, low]);

    // Without the id tie-break the comparator returns 0, stable sort preserves
    // arrival order, and these two runs disagree (green vs red).
    expect(forward).toBe(reversed);
    // The greater id wins the final tie-break.
    expect(forward).toBe("red");
  });
});

// A republished period is two published reports sharing a `periodEnd` calendar
// day; leadVelocity groups by that label so both reports' leads land in ONE row
// rather than a duplicate series point per report.
describe("AnalyticsPrismaRepository leadVelocity period-label grouping", () => {
  it("collapses two reports sharing a period label into one row", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        periodEnd: new Date("2026-04-21T08:00:00.000Z"),
        sections: [{ authorId: "lead-one", author: { name: "Lead One" } }],
      },
      {
        periodEnd: new Date("2026-04-21T20:00:00.000Z"),
        sections: [{ authorId: "lead-two", author: { name: "Lead Two" } }],
      },
    ]);
    const prisma = { report: { findMany } } as unknown as PrismaService;
    const repo = new AnalyticsPrismaRepository(prisma);

    const out = await repo.leadVelocity(HISTORY_INPUT, adminSession);

    expect(out).toHaveLength(1);
    expect(out[0]?.periodLabel).toBe("2026-04-21");
    expect(out[0]?.leads.map((l) => l.leadId)).toEqual([
      "lead-one",
      "lead-two",
    ]);
  });
});
