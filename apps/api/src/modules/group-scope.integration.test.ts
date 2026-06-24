import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { groupScopeFilter } from "../lib/group-scope";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../test-utils/prisma-test-helper";

/**
 * TD-02 / Phase 46-05 follow-up: live-Prisma cross-group visibility matrix.
 *
 * Seeds two groups (A and B), one section per group, one admin, one viewer.
 * Verifies that each role sees exactly the rows it should via groupScopeFilter
 * fragments spread into real Prisma queries.
 *
 * Covers the "~20% extra confidence" gap noted in 46-05-SUMMARY: we already
 * had unit-level helper tests + service-spy tests; this adds a layer that
 * catches schema drift or Prisma relation-path renames.
 */
describe("group-scope visibility matrix (integration, TD-02)", () => {
  const prisma = createTestPrisma();

  // Stable UUIDs for this test file (prefix 'c' to avoid collision with TEST_IDS).
  const IDS = {
    groupA: "c0000000-0000-4000-a000-000000000010",
    groupB: "c0000000-0000-4000-a000-000000000020",
    headA: "c0000000-0000-4000-a000-000000000011",
    leadA: "c0000000-0000-4000-a000-000000000012",
    headB: "c0000000-0000-4000-a000-000000000021",
    leadB: "c0000000-0000-4000-a000-000000000022",
    admin: "c0000000-0000-4000-a000-000000000030",
    viewer: "c0000000-0000-4000-a000-000000000040",
    report: "c0000000-0000-4000-a000-000000000050",
    sectionA: "c0000000-0000-4000-a000-000000000061",
    sectionB: "c0000000-0000-4000-a000-000000000062",
  } as const;

  beforeEach(async () => {
    await cleanDatabase(prisma);

    await prisma.reportingGroup.createMany({
      data: [
        { id: IDS.groupA, name: "Group A" },
        { id: IDS.groupB, name: "Group B" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: IDS.headA,
          email: "headA@t.local",
          name: "Head A",
          lastName: "Head",
          firstName: "A",
          role: "head",
          samlId: "hA",
          reportingGroupId: IDS.groupA,
        },
        {
          id: IDS.leadA,
          email: "leadA@t.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "lA",
          reportingGroupId: IDS.groupA,
        },
        {
          id: IDS.headB,
          email: "headB@t.local",
          name: "Head B",
          lastName: "Head",
          firstName: "B",
          role: "head",
          samlId: "hB",
          reportingGroupId: IDS.groupB,
        },
        {
          id: IDS.leadB,
          email: "leadB@t.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "lB",
          reportingGroupId: IDS.groupB,
        },
        {
          id: IDS.admin,
          email: "admin@t.local",
          name: "Admin",
          lastName: "Admin",
          firstName: "Test",
          role: "admin",
          samlId: "adm",
          reportingGroupId: IDS.groupA,
        },
        {
          id: IDS.viewer,
          email: "viewer@t.local",
          name: "Viewer",
          lastName: "Viewer",
          firstName: "Test",
          role: "viewer",
          samlId: "vwr",
          reportingGroupId: IDS.groupA,
        },
      ],
    });
    await prisma.report.create({
      data: {
        id: IDS.report,
        periodStart: new Date("2026-05-05"),
        periodEnd: new Date("2026-05-11"),
        deadline: new Date("2026-05-09"),
      },
    });
    await prisma.reportSection.createMany({
      data: [
        {
          id: IDS.sectionA,
          reportId: IDS.report,
          authorId: IDS.leadA,
          status: "draft",
        },
        {
          id: IDS.sectionB,
          reportId: IDS.report,
          authorId: IDS.leadB,
          status: "draft",
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  function makeSession(
    userId: string,
    role: UserSession["role"],
    groupId: string,
    viewerGroupAccess: string[] = [],
  ): UserSession {
    return {
      userId,
      role,
      reportingGroupId: groupId,
      viewerGroupAccess,
      name: "",
      email: "",
    };
  }

  async function querySections(session: UserSession): Promise<string[]> {
    const scope = groupScopeFilter(session, "reportSection");
    const rows = await prisma.reportSection.findMany({
      where: { reportId: IDS.report, ...scope },
      select: { id: true },
    });
    return rows.map((r) => r.id).sort();
  }

  it("head-A sees only group-A section", async () => {
    const ids = await querySections(makeSession(IDS.headA, "head", IDS.groupA));
    expect(ids).toEqual([IDS.sectionA]);
  });

  it("lead-A sees only group-A section", async () => {
    const ids = await querySections(makeSession(IDS.leadA, "lead", IDS.groupA));
    expect(ids).toEqual([IDS.sectionA]);
  });

  it("head-B sees only group-B section", async () => {
    const ids = await querySections(makeSession(IDS.headB, "head", IDS.groupB));
    expect(ids).toEqual([IDS.sectionB]);
  });

  it("admin sees both sections", async () => {
    const ids = await querySections(
      makeSession(IDS.admin, "admin", IDS.groupA),
    );
    expect(ids).toEqual([IDS.sectionA, IDS.sectionB].sort());
  });

  it("viewer with group-A access sees only group-A section", async () => {
    const ids = await querySections(
      makeSession(IDS.viewer, "viewer", IDS.groupA, [IDS.groupA]),
    );
    expect(ids).toEqual([IDS.sectionA]);
  });

  it("viewer with group-B access sees only group-B section", async () => {
    const ids = await querySections(
      makeSession(IDS.viewer, "viewer", IDS.groupA, [IDS.groupB]),
    );
    expect(ids).toEqual([IDS.sectionB]);
  });

  it("viewer with both groups sees both sections", async () => {
    const ids = await querySections(
      makeSession(IDS.viewer, "viewer", IDS.groupA, [IDS.groupA, IDS.groupB]),
    );
    expect(ids).toEqual([IDS.sectionA, IDS.sectionB].sort());
  });

  it("viewer with empty access sees zero sections", async () => {
    const ids = await querySections(
      makeSession(IDS.viewer, "viewer", IDS.groupA, []),
    );
    expect(ids).toHaveLength(0);
  });
});
