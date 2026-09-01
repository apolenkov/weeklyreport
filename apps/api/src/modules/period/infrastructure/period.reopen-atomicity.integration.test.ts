import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { AdminPeriodAlreadyArchivedError } from "../../admin/index.js";
import { archivePeriod } from "../../admin/test-seams/index.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import {
  PeriodScopeError,
  PeriodStaleStateError,
} from "../application/period.service";
import { PeriodPrismaRepository } from "./period.prisma-repository";

// Real-Postgres coverage for the reopen-versus-archive race: both writers'
// pre-checks are TOCTOU reads, so the guarded CAS on both legs (keyed on the
// same discriminator) bounds the row to a single writer; the loser fails closed.
describe("PeriodPrismaRepository reopen atomicity (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );

  const REPORT = "f0000000-0000-4000-a000-0000000000e1";
  const USER = "00000000-0000-4000-8000-0000000000e9";

  async function expected(reportId: string) {
    const report = await repository.getReportById(reportId);
    if (!report) throw new Error(`Report ${reportId} was not found.`);
    return report;
  }

  async function createPublishedReport(): Promise<void> {
    await prisma.user.create({
      data: {
        id: USER,
        email: "head-reopen-atomicity@test.local",
        name: "Reopen Atomicity Head",
        lastName: "Head",
        firstName: "Reopen",
        role: "head",
        samlId: "head-reopen-atomicity",
      },
    });
    // A published, non-archived period with one submitted section — the exact
    // shape a head can reopen and an admin can archive.
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: new Date("2026-06-08T00:00:00.000Z"),
        periodEnd: new Date("2026-06-14T00:00:00.000Z"),
        deadline: new Date("2026-06-12T00:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-06-13T00:00:00.000Z"),
        publishedById: USER,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: REPORT,
          periodStart: "2026-06-08T00:00:00.000Z",
          periodEnd: "2026-06-14T00:00:00.000Z",
          deadline: "2026-06-12T00:00:00.000Z",
          publishedAt: "2026-06-13T00:00:00.000Z",
          publishedById: USER,
          publishedByName: "Reopen Atomicity Head",
        }),
      },
    });
    await prisma.reportSection.create({
      data: {
        reportId: REPORT,
        authorId: USER,
        status: "submitted",
        submittedAt: new Date("2026-06-11T00:00:00.000Z"),
      },
    });
  }

  beforeEach(async () => {
    await cleanDatabase();
    await createPublishedReport();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function loadRow() {
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: REPORT },
    });
    const sections = await prisma.reportSection.findMany({
      where: { reportId: REPORT },
      select: { status: true },
    });
    return { row, sections };
  }

  it("reopens a published period once and resets its submitted sections", async () => {
    await repository.reopenPeriod(REPORT, await expected(REPORT));

    const { row, sections } = await loadRow();
    expect(row.periodStatus).toBe("reopened");
    expect(row.periodState).toBe("open");
    expect(row.archived).toBe(false);
    expect(row.reopenedAt).not.toBeNull();
    expect(sections.every((s) => s.status === "draft")).toBe(true);
  });

  it("archives a published period once, leaving its sections submitted", async () => {
    await archivePeriod(prisma as unknown as PrismaService, REPORT);

    const { row, sections } = await loadRow();
    expect(row.archived).toBe(true);
    expect(row.periodState).toBe("archived");
    expect(sections.every((s) => s.status === "submitted")).toBe(true);
  });

  it("archives a scheduled (never-published) period — the CAS bounds only the reopened state, not period status generally", async () => {
    // Head/admin archive is unbounded by period status (product decision): a
    // scheduled period must stay archivable. Only `reopened` is excluded, since
    // archiving it would freeze just-reset draft sections either way.
    const SCHEDULED = "f0000000-0000-4000-a000-0000000000e2";
    await prisma.report.create({
      data: {
        id: SCHEDULED,
        periodStart: new Date("2026-06-15T00:00:00.000Z"),
        periodEnd: new Date("2026-06-21T00:00:00.000Z"),
        deadline: new Date("2026-06-19T00:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "scheduled",
      },
    });

    await archivePeriod(prisma as unknown as PrismaService, SCHEDULED);

    const row = await prisma.report.findUniqueOrThrow({
      where: { id: SCHEDULED },
    });
    expect(row.archived).toBe(true);
    expect(row.periodState).toBe("archived");
  });

  it("fails the reopen closed when an archive already won the row", async () => {
    // Archive first (commits), then reopen: the reopen compare-and-set's
    // `archived: false` clause drops it to zero rows, so it fails closed and
    // resets no sections — an archived period is never left editable.
    const beforeArchive = await expected(REPORT);
    await archivePeriod(prisma as unknown as PrismaService, REPORT);

    await expect(
      repository.reopenPeriod(REPORT, beforeArchive),
    ).rejects.toBeInstanceOf(PeriodScopeError);

    const { row, sections } = await loadRow();
    expect(row.archived).toBe(true);
    expect(row.periodState).toBe("archived");
    // Never editable-archived: an archived row must not be at periodState=open.
    expect(row.periodState).not.toBe("open");
    // The archive that won kept its submitted sections — no reset leaked behind.
    expect(sections.every((s) => s.status === "submitted")).toBe(true);
  });

  it("returns typed stale when the period boundary changes after the expectation read", async () => {
    const beforeBoundaryMutation = await expected(REPORT);
    await prisma.report.update({
      where: { id: REPORT },
      data: { periodEnd: new Date("2026-06-15T00:00:00.000Z") },
    });

    await expect(
      repository.reopenPeriod(REPORT, beforeBoundaryMutation),
    ).rejects.toBeInstanceOf(PeriodStaleStateError);

    const { row, sections } = await loadRow();
    expect(row.periodEnd).toEqual(new Date("2026-06-15T00:00:00.000Z"));
    expect(row.periodStatus).toBe("published");
    expect(row.periodState).toBe("published");
    expect(sections.every((s) => s.status === "submitted")).toBe(true);
  });

  it("fails the archive closed when a reopen already won the row", async () => {
    // Reopen first (flips periodStatus→reopened), then archive: the archive
    // CAS's `periodStatus: { not: "reopened" }` clause drops to zero rows, so
    // it fails closed rather than stranding reset sections behind an archived row.
    await repository.reopenPeriod(REPORT, await expected(REPORT));

    await expect(
      archivePeriod(prisma as unknown as PrismaService, REPORT),
    ).rejects.toBeInstanceOf(AdminPeriodAlreadyArchivedError);

    const { row, sections } = await loadRow();
    expect(row.archived).toBe(false);
    expect(row.periodState).toBe("open");
    expect(row.periodStatus).toBe("reopened");
    expect(sections.every((s) => s.status === "draft")).toBe(true);
  });

  it("commits exactly one writer under a concurrent reopen and archive", async () => {
    const state = await expected(REPORT);
    const [reopenResult, archiveResult] = await Promise.allSettled([
      repository.reopenPeriod(REPORT, state),
      archivePeriod(prisma as unknown as PrismaService, REPORT),
    ]);

    // Exactly one writer wins; the other fails closed with its domain error.
    const fulfilled = [reopenResult, archiveResult].filter(
      (r) => r.status === "fulfilled",
    );
    const rejected = [reopenResult, archiveResult].filter(
      (r) => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const { row, sections } = await loadRow();

    // The load-bearing invariant, holding in either ordering: an archived row is
    // never left editable (periodState=open), and an archived row never has its
    // sections reset to draft.
    const editableArchived = row.archived && row.periodState === "open";
    expect(editableArchived).toBe(false);
    const archivedWithResetSections =
      row.archived && sections.some((s) => s.status === "draft");
    expect(archivedWithResetSections).toBe(false);

    if (reopenResult.status === "fulfilled") {
      // Reopen won: archive lost on the shared discriminator.
      expect(archiveResult.status).toBe("rejected");
      expect(row.periodStatus).toBe("reopened");
      expect(row.periodState).toBe("open");
      expect(row.archived).toBe(false);
      expect(sections.every((s) => s.status === "draft")).toBe(true);
    } else {
      // Archive won: reopen lost on the `archived: false` clause.
      expect(archiveResult.status).toBe("fulfilled");
      expect(reopenResult.reason).toBeInstanceOf(PeriodScopeError);
      expect(row.archived).toBe(true);
      expect(row.periodState).toBe("archived");
      expect(sections.every((s) => s.status === "submitted")).toBe(true);
    }
  });
});
