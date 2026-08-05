import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../../weekly-report/index.js";
import { PeriodPrismaRepository } from "./period.prisma-repository";

// Real-Postgres coverage for the publish compare-and-set: two concurrent
// publishes both clear the service-level check, so the guarded updateMany is
// the only thing bounding the period to a single transition.
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

  it("transitions a reopened period back to published", async () => {
    // A reopened period keeps the legacy tuple (status="published") but flips
    // periodStatus to "reopened". The shared guard keys on periodStatus, not
    // legacy status, so it must still transition here.
    await prisma.report.update({
      where: { id: REPORT },
      data: { status: "published", periodStatus: "reopened" },
    });

    const result = await repository.publishPeriod(REPORT, USER);

    expect(result).toEqual({ transitioned: true });
    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.periodState).toBe("published");
  });

  it("reports no transition (raced) for an already-published period", async () => {
    await repository.publishPeriod(REPORT, USER);

    await expect(repository.publishPeriod(REPORT, USER)).resolves.toEqual({
      transitioned: false,
      reason: "raced",
    });
  });

  it("fails closed (reason archived) for a period archived inside the window", async () => {
    // The archive transition leaves periodStatus open, so the pre-write
    // archived check cannot catch an archive landing after it. The `archived:
    // false` predicate closes the race — a zero-row match writes nothing.
    await prisma.report.update({
      where: { id: REPORT },
      data: { archived: true, periodState: "archived" },
    });

    await expect(repository.publishPeriod(REPORT, USER)).resolves.toEqual({
      transitioned: false,
      reason: "archived",
    });

    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.archived).toBe(true);
    expect(reloaded?.status).toBe("draft");
    expect(reloaded?.periodStatus).toBe("open");
    expect(reloaded?.periodStatus).not.toBe("published");
    expect(reloaded?.periodState).toBe("archived");
    expect(reloaded?.publishedSnapshot).toBeNull();
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
