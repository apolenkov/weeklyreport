import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";
import { WeeklyReportService } from "./weekly-report.service";

// Real-Prisma coverage for getLatestPublishedNonArchivedId (head reopen target).
describe("WeeklyReportPrismaRepository.getLatestPublishedNonArchivedId (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );

  const OLD_PUBLISHED = "e0000000-0000-4000-a000-0000000000a1";
  const NEW_PUBLISHED = "e0000000-0000-4000-a000-0000000000a2";
  const ARCHIVED_PUBLISHED = "e0000000-0000-4000-a000-0000000000a3";
  const OPEN = "e0000000-0000-4000-a000-0000000000a4";
  const TIE_LOW = "e0000000-0000-4000-a000-0000000000a5";
  const TIE_HIGH = "e0000000-0000-4000-a000-0000000000a6";
  const viewerSession: UserSession = {
    userId: "e0000000-0000-4000-a000-0000000000b1",
    email: "viewer@example.test",
    name: "Viewer",
    role: "viewer",
    viewerGroupAccess: [],
  };

  async function createReport(
    id: string,
    periodStatus: "open" | "published",
    periodStart: string,
    archived = false,
  ): Promise<void> {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        status: periodStatus === "published" ? "published" : "draft",
        periodStatus,
        // Set periodState to match periodStatus so a published row is NOT subject
        // to the partial `one_open_per_boundary` index — two published rows may
        // legitimately share a periodStart (the tie case) without colliding.
        periodState: archived
          ? "archived"
          : periodStatus === "published"
            ? "published"
            : "open",
        archived,
      },
    });
  }

  beforeEach(async () => {
    await prisma.report.deleteMany();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("returns the newest non-archived published period", async () => {
    await createReport(OLD_PUBLISHED, "published", "2026-05-04T00:00:00.000Z");
    await createReport(NEW_PUBLISHED, "published", "2026-05-18T00:00:00.000Z");

    await expect(repository.getLatestPublishedNonArchivedId()).resolves.toBe(
      NEW_PUBLISHED,
    );
  });

  it("EXCLUDES an archived newest published row and returns the older non-archived one", async () => {
    // The archived period is NEWER; the archived:false filter must skip it so
    // a head can reopen the older non-archived published period.
    await createReport(OLD_PUBLISHED, "published", "2026-05-04T00:00:00.000Z");
    await createReport(
      ARCHIVED_PUBLISHED,
      "published",
      "2026-05-25T00:00:00.000Z",
      true,
    );

    await expect(repository.getLatestPublishedNonArchivedId()).resolves.toBe(
      OLD_PUBLISHED,
    );
  });

  it("ignores non-published periods", async () => {
    await createReport(OPEN, "open", "2026-05-25T00:00:00.000Z");
    await createReport(OLD_PUBLISHED, "published", "2026-05-04T00:00:00.000Z");

    await expect(repository.getLatestPublishedNonArchivedId()).resolves.toBe(
      OLD_PUBLISHED,
    );
  });

  it("returns null when no non-archived published period exists", async () => {
    await createReport(
      ARCHIVED_PUBLISHED,
      "published",
      "2026-05-18T00:00:00.000Z",
      true,
    );
    await createReport(OPEN, "open", "2026-05-25T00:00:00.000Z");

    await expect(
      repository.getLatestPublishedNonArchivedId(),
    ).resolves.toBeNull();
  });

  it("does not default to an archived-only published report", async () => {
    await createReport(
      ARCHIVED_PUBLISHED,
      "published",
      "2026-05-18T00:00:00.000Z",
      true,
    );

    const service = new WeeklyReportService(repository);
    await expect(
      service.getWeeklyReport(undefined, viewerSession),
    ).resolves.toEqual({
      status: "no-period",
      report: null,
      crossGroup: null,
    });
  });

  it("breaks a same-periodStart tie deterministically by id desc", async () => {
    await createReport(TIE_LOW, "published", "2026-05-18T00:00:00.000Z");
    await createReport(TIE_HIGH, "published", "2026-05-18T00:00:00.000Z");

    const tiedIds = await prisma.report.findMany({
      where: { id: { in: [TIE_LOW, TIE_HIGH] } },
      orderBy: { id: "asc" },
      select: { id: true, periodStart: true },
    });
    expect(tiedIds).toEqual([
      { id: TIE_LOW, periodStart: new Date("2026-05-18T00:00:00.000Z") },
      { id: TIE_HIGH, periodStart: new Date("2026-05-18T00:00:00.000Z") },
    ]);

    await expect(repository.getLatestPublishedNonArchivedId()).resolves.toBe(
      TIE_HIGH,
    );
  });
});
