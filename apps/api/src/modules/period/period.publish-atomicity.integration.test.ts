import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository";
import { PeriodPrismaRepository } from "./period.prisma-repository";

/**
 * Real-Postgres coverage for the publish compare-and-set. Two concurrent
 * publishes both clear the service-level already-published check, so the
 * guarded `updateMany({ periodStatus: { not: "published" } })` is the only
 * thing that bounds the period to a single transition. Proves the ground truth
 * the mock-based service tests cannot: exactly one call transitions the row and
 * rebuilds the snapshot under a real race.
 */
describe("PeriodPrismaRepository publish atomicity (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );

  const REPORT = "f0000000-0000-4000-a000-0000000000d1";
  const USER = "00000000-0000-4000-8000-0000000000d9";

  async function createOpenReport(): Promise<void> {
    // The publish transition stamps publishedById, which references User.
    await prisma.user.create({
      data: {
        id: USER,
        email: "head-atomicity@test.local",
        name: "Atomicity Head",
        lastName: "Head",
        firstName: "Atomicity",
        role: "head",
        samlId: "head-atomicity",
      },
    });
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: new Date("2026-05-11T00:00:00.000Z"),
        periodEnd: new Date("2026-05-17T00:00:00.000Z"),
        deadline: new Date("2026-05-15T00:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
      },
    });
  }

  beforeEach(async () => {
    // Reports reference User via publishedById, so clear them first.
    await prisma.report.deleteMany();
    await prisma.user.deleteMany();
    await createOpenReport();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("transitions an open period once and writes the snapshot", async () => {
    const result = await repository.publishPeriod(REPORT, USER);

    expect(result).toEqual({ transitioned: true });
    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.periodState).toBe("published");
    expect(reloaded?.publishedById).toBe(USER);
    expect(reloaded?.publishedSnapshot).not.toBeNull();
  });

  it("reports no transition for an already-published period", async () => {
    await repository.publishPeriod(REPORT, USER);

    await expect(repository.publishPeriod(REPORT, USER)).resolves.toEqual({
      transitioned: false,
    });
  });

  it("transitions exactly once under two concurrent publishes", async () => {
    const [first, second] = await Promise.all([
      repository.publishPeriod(REPORT, USER),
      repository.publishPeriod(REPORT, USER),
    ]);

    // Exactly one wins the compare-and-set; the loser matches zero rows.
    expect([first.transitioned, second.transitioned].sort()).toEqual([
      false,
      true,
    ]);

    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.publishedSnapshot).not.toBeNull();
  });
});
