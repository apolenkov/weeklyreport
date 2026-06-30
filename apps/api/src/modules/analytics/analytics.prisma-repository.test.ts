import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository";

/**
 * The load-bearing leak fix is the nested `include.sections.where` scope (a
 * Report is a unified period holding every group's sections). These tests
 * assert the exact group-scope fragment lands on the INCLUDED sections — a
 * scope applied only top-level would false-green the integration test, so this
 * runnable unit test guards against that regression directly.
 */

const GROUP = "a0000000-0000-4000-8000-0000000group-g";
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
  const findFirst = vi.fn((_query: unknown) => Promise.resolve(null));
  const prisma = {
    report: { findMany, findFirst },
  } as unknown as PrismaService;
  return { repo: new AnalyticsPrismaRepository(prisma), findMany, findFirst };
}

describe("AnalyticsPrismaRepository group scoping", () => {
  it("trafficLightHistory scopes the included sections for a non-admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.trafficLightHistory(HISTORY_INPUT, headG);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual(SCOPE);
    expect(arg.where.sections).toEqual({ some: SCOPE });
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
    expect(arg.where.sections).toEqual({ some: SCOPE });
  });

  it("leadVelocity keeps only the submitted filter for admin", async () => {
    const { repo, findMany } = makeRepo();
    await repo.leadVelocity(HISTORY_INPUT, adminSession);

    const arg = findMany.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual({ status: "submitted" });
    expect(arg.where.sections).toBeUndefined();
  });

  it("periodComparison scopes the included sections for a non-admin", async () => {
    const { repo, findFirst } = makeRepo();
    await repo.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headG,
    );

    const arg = findFirst.mock.calls[0]?.[0] as ReportQueryArg;
    expect(arg.include.sections.where).toEqual(SCOPE);
    expect(arg.where.sections).toEqual({ some: SCOPE });
  });

  it("periodComparison leaves sections unfiltered for admin", async () => {
    const { repo, findFirst } = makeRepo();
    await repo.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      adminSession,
    );

    const arg = findFirst.mock.calls[0]?.[0] as ReportQueryArg;
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
