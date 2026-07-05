import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository";
import { PeriodPrismaRepository } from "./period.prisma-repository";
import {
  type AnalyticsCacheInvalidator,
  PeriodScopeError,
  PeriodService,
  type ReopenPolicyReader,
} from "./period.service";

const noopInvalidate: AnalyticsCacheInvalidator = () => Promise.resolve();
const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

/**
 * Real-Prisma coverage for the single-active-reopen guard. The unit tests pin
 * the service branch against a mock map; this proves the ground truth against
 * Postgres:
 *   - `getReopenedNonArchivedId` matches the `periodStatus='reopened'`,
 *     `archived=false` marker the reopen transition actually writes, and skips
 *     an archived reopened row;
 *   - end-to-end, a head who has reopened the latest published period CANNOT
 *     reopen the next-latest (the walk-back the guard exists to block), while an
 *     admin still can (the recovery path).
 */
describe("PeriodService single-active-reopen guard (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );
  const service = new PeriodService(
    repository,
    noopInvalidate,
    noGatingReopenPolicy,
  );

  const PUBLISHED_A = "f0000000-0000-4000-a000-0000000000b1";
  const PUBLISHED_B = "f0000000-0000-4000-a000-0000000000b2";
  const REOPENED = "f0000000-0000-4000-a000-0000000000b3";
  const REOPENED_ARCHIVED = "f0000000-0000-4000-a000-0000000000b4";

  const headSession: UserSession = {
    userId: "00000000-0000-4000-8000-0000000000c1",
    email: "head@customreport.local",
    name: "Department Head",
    role: "head",
    activeReportId: null,
    activeReportSectionId: null,
  };
  const adminSession: UserSession = {
    ...headSession,
    userId: "00000000-0000-4000-8000-0000000000c9",
    role: "admin",
  };

  async function createReport(
    id: string,
    periodStatus: "published" | "reopened",
    periodStart: string,
    archived = false,
  ): Promise<void> {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        // A reopened period keeps the legacy published tuple but reverts the
        // canonical periodState to 'open' (the reopen transition's asymmetry).
        status: "published",
        periodStatus,
        periodState: archived
          ? "archived"
          : periodStatus === "reopened"
            ? "open"
            : "published",
        publishedAt: new Date(periodStart),
        archived,
      },
    });
  }

  beforeEach(async () => {
    await prisma.report.deleteMany();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("returns null when no reopened period exists", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");

    await expect(repository.getReopenedNonArchivedId()).resolves.toBeNull();
  });

  it("returns the reopened non-archived period and skips an archived reopened row", async () => {
    await createReport(
      REOPENED_ARCHIVED,
      "reopened",
      "2026-05-25T00:00:00.000Z",
      true,
    );
    await createReport(REOPENED, "reopened", "2026-05-11T00:00:00.000Z");

    await expect(repository.getReopenedNonArchivedId()).resolves.toBe(REOPENED);
  });

  it("blocks a head from reopening a second period while one is already reopened (walk-back)", async () => {
    // A is the newest published, B the next-newest. The head legitimately
    // reopens A; reopening B afterwards would walk back into history.
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    await createReport(PUBLISHED_B, "published", "2026-05-11T00:00:00.000Z");

    await service.reopenPeriod(PUBLISHED_A, headSession);
    await expect(repository.getReopenedNonArchivedId()).resolves.toBe(
      PUBLISHED_A,
    );

    // With A reopened, getLatestPublishedNonArchivedId resolves to B, so the
    // target-match passes — the single-active-reopen guard is what rejects it.
    await expect(
      service.reopenPeriod(PUBLISHED_B, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);

    const b = await prisma.report.findUnique({ where: { id: PUBLISHED_B } });
    expect(b?.periodStatus).toBe("published");
  });

  it("lets an admin reopen a second period while one is reopened (recovery path)", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    await createReport(PUBLISHED_B, "published", "2026-05-11T00:00:00.000Z");

    await service.reopenPeriod(PUBLISHED_A, headSession);

    await expect(
      service.reopenPeriod(PUBLISHED_B, adminSession),
    ).resolves.toEqual({ success: true, reportId: PUBLISHED_B });
    const b = await prisma.report.findUnique({ where: { id: PUBLISHED_B } });
    expect(b?.periodStatus).toBe("reopened");
  });
});
