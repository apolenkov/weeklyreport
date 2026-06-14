import type { UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { ActivityPrismaRepository } from "./activity.prisma-repository";

describe("ActivityPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ActivityPrismaRepository;

  const groupA = "a0000000-0000-4000-a000-000000000401";
  const groupB = "a0000000-0000-4000-a000-000000000402";
  const headA = "a0000000-0000-4000-a000-000000000403";
  const leadA = "a0000000-0000-4000-a000-000000000404";
  const leadB = "a0000000-0000-4000-a000-000000000405";
  const reportId = "a0000000-0000-4000-a000-000000000406";

  beforeAll(() => {
    repo = new ActivityPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.reportingGroup.createMany({
      data: [
        { id: groupA, name: "Software Development", description: null },
        { id: groupB, name: "Finance", description: null },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: headA,
          email: "head-a@test.local",
          name: "Head A",
          role: "head",
          samlId: "head-a",
          reportingGroupId: groupA,
        },
        {
          id: leadA,
          email: "lead-a@test.local",
          name: "Lead A",
          role: "lead",
          samlId: "lead-a",
          reportingGroupId: groupA,
        },
        {
          id: leadB,
          email: "lead-b@test.local",
          name: "Lead B",
          role: "lead",
          samlId: "lead-b",
          reportingGroupId: groupB,
        },
      ],
    });
    await prisma.report.create({
      data: {
        id: reportId,
        periodStart: new Date("2026-05-04T00:00:00.000Z"),
        periodEnd: new Date("2026-05-10T00:00:00.000Z"),
        deadline: new Date("2026-05-09T12:00:00.000Z"),
        status: "draft",
        periodStatus: "reopened",
        periodState: "open",
      },
    });
    await prisma.reportSection.createMany({
      data: [
        { reportId, authorId: leadA, status: "draft" },
        { reportId, authorId: leadB, status: "submitted" },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("scopes live rows to the head reporting group and includes reopened periods", async () => {
    const session: UserSession = {
      userId: headA,
      email: "head-a@test.local",
      name: "Head A",
      role: "head",
      reportingGroupId: groupA,
    };

    const result = await repo.getLiveActivity(session);

    expect(result.reportId).toBe(reportId);
    expect(result.periodStatus).toBe("reopened");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.leadId).toBe(leadA);
  });

  it("ignores a scheduled-future open period and resolves the current one", async () => {
    // A scheduled-future period carries periodStatus="open" (the enum has no
    // "scheduled" value). Without the periodStart <= now guard it would win the
    // periodStart-desc ordering and surface its empty section list, making every
    // lead read "not started". The current period must win instead.
    const futureReportId = "a0000000-0000-4000-a000-000000000407";
    const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.report.create({
      data: {
        id: futureReportId,
        periodStart: futureStart,
        periodEnd: new Date(futureStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        deadline: new Date(futureStart.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: "draft",
        periodStatus: "open",
        periodState: "scheduled",
      },
    });

    const session: UserSession = {
      userId: headA,
      email: "head-a@test.local",
      name: "Head A",
      role: "head",
      reportingGroupId: groupA,
    };

    const result = await repo.getLiveActivity(session);

    expect(result.reportId).toBe(reportId);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.leadId).toBe(leadA);
  });
});
