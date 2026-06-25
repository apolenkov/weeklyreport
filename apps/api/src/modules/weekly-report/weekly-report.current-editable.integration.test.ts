import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";

/**
 * viewer-live-status (task 0.2): real-Prisma coverage for
 * `getCurrentEditableId()` — the single source of truth for the viewer
 * published-or-current gate and the `latestForViewer` resolver. The stub
 * where-shape test (in weekly-report.prisma-repository.test.ts) pins the query;
 * this one runs the filter against Postgres and proves the behaviour:
 *   - the newest editable (open/reopened) started period wins;
 *   - an archived row still carrying periodStatus="open" is EXCLUDED
 *     (archived:false — the mutation sentinel);
 *   - a scheduled-future period (periodStart > now) is excluded;
 *   - a published-only state returns null (NO published fallback).
 */
describe("WeeklyReportPrismaRepository.getCurrentEditableId (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );

  const OLD_OPEN = "d0000000-0000-4000-a000-0000000000f1";
  const NEW_OPEN = "d0000000-0000-4000-a000-0000000000f2";
  const REOPENED = "d0000000-0000-4000-a000-0000000000f3";
  const ARCHIVED_OPEN = "d0000000-0000-4000-a000-0000000000f4";
  const FUTURE_OPEN = "d0000000-0000-4000-a000-0000000000f5";
  const PUBLISHED = "d0000000-0000-4000-a000-0000000000f6";

  async function createReport(
    id: string,
    periodStatus: "open" | "published" | "reopened",
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

  it("returns the newest editable (reopened over older open) started period", async () => {
    await createReport(OLD_OPEN, "open", "2026-05-04T00:00:00.000Z");
    await createReport(REOPENED, "reopened", "2026-05-18T00:00:00.000Z");

    await expect(repository.getCurrentEditableId()).resolves.toBe(REOPENED);
  });

  it("prefers the newest open period when several started editable periods exist", async () => {
    await createReport(OLD_OPEN, "open", "2026-05-04T00:00:00.000Z");
    await createReport(NEW_OPEN, "open", "2026-05-25T00:00:00.000Z");

    await expect(repository.getCurrentEditableId()).resolves.toBe(NEW_OPEN);
  });

  it("EXCLUDES an archived row still carrying periodStatus='open' (archived:false teeth)", async () => {
    // The archived-open period is NEWER than the live open period; without the
    // archived:false filter it would win the periodStart-desc ordering and leak.
    await createReport(NEW_OPEN, "open", "2026-05-11T00:00:00.000Z");
    await createReport(ARCHIVED_OPEN, "open", "2026-05-25T00:00:00.000Z", true);

    await expect(repository.getCurrentEditableId()).resolves.toBe(NEW_OPEN);
  });

  it("excludes a scheduled-future period (periodStart > now)", async () => {
    await createReport(NEW_OPEN, "open", "2026-05-11T00:00:00.000Z");
    await createReport(FUTURE_OPEN, "open", "2099-01-01T00:00:00.000Z");

    await expect(repository.getCurrentEditableId()).resolves.toBe(NEW_OPEN);
  });

  it("returns null with no editable period — a published-only state has NO fallback", async () => {
    await createReport(PUBLISHED, "published", "2026-05-18T00:00:00.000Z");

    await expect(repository.getCurrentEditableId()).resolves.toBeNull();
  });

  it("breaks a same-periodStart tie deterministically (concurrent editable periods)", async () => {
    // Two concurrent editable periods sharing a periodStart is a SUPPORTED state
    // (no period-creation lock). Without a total-order tiebreak the DB could
    // return either row, and because the gate and the resolver call this helper
    // separately they could pick DIFFERENT periods. The `id desc` tiebreak makes
    // the pick stable: OLD_OPEN (…f1) and NEW_OPEN (…f2) share a periodStart, so
    // the higher id wins, identically on every call.
    await createReport(OLD_OPEN, "open", "2026-05-18T00:00:00.000Z");
    await createReport(NEW_OPEN, "open", "2026-05-18T00:00:00.000Z");

    const first = await repository.getCurrentEditableId();
    const second = await repository.getCurrentEditableId();

    expect(first).toBe(NEW_OPEN);
    expect(second).toBe(first);
  });
});
