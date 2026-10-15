import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { groupScopeFilter } from "../../../lib/group-scope.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { AdminReopenRequestNotFoundError } from "../../admin/admin-errors.js";
import { deleteReport } from "../../admin/admin-period.queries.js";
import { decideReopenRequest } from "../../admin/admin-reopen-request-lifecycle.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../domain/lead-form-shared.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";
import {
  publishTarget,
  seedFillRows,
  targetRows,
} from "./lead-form-write-lock.fixtures.js";

describe("lead-form published-period write locks (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new LeadFormPrismaRepository(prisma as unknown as PrismaService);
  const publishedAt = new Date("2026-07-22T12:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("rejects fill when publish commits before its transaction starts", async () => {
    const testData = await seedTestData(prisma);
    const sourceSectionId = await seedFillRows(prisma, testData);
    const before = await targetRows(prisma, testData);
    const gate = createPauseGate();
    const pausedRepo = new LeadFormPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as unknown as PrismaService,
    );

    const fill = pausedRepo.fillFromSection(
      testData.section.id,
      sourceSectionId,
      testData.section.version,
    );
    await gate.paused;
    await publishTarget(prisma, testData);
    gate.release();

    await expect(fill).rejects.toBeInstanceOf(LeadFormConstraintError);
    await expect(targetRows(prisma, testData)).resolves.toEqual(before);
  });

  it("rejects fill of an archived report even while periodStatus stays open", async () => {
    // The archive transition does not touch periodStatus, so the in-tx gate
    // must check `archived` itself — an admin archive committing in the
    // precheck→tx window would otherwise pass.
    const testData = await seedTestData(prisma);
    const sourceSectionId = await seedFillRows(prisma, testData);
    const before = await targetRows(prisma, testData);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    await expect(
      repo.fillFromSection(
        testData.section.id,
        sourceSectionId,
        testData.section.version,
      ),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    await expect(targetRows(prisma, testData)).resolves.toEqual(before);
  });

  it("reports NOT_FOUND, not a period constraint, for a section deleted mid-flight", async () => {
    const testData = await seedTestData(prisma);
    const sourceSectionId = await seedFillRows(prisma, testData);
    await prisma.reportSection.delete({ where: { id: testData.section.id } });

    await expect(
      repo.fillFromSection(
        testData.section.id,
        sourceSectionId,
        testData.section.version,
      ),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
  });

  it("rejects direct fill of an already-published target without writes", async () => {
    const testData = await seedTestData(prisma);
    const sourceSectionId = await seedFillRows(prisma, testData);
    const before = await targetRows(prisma, testData);
    await publishTarget(prisma, testData);

    await expect(
      repo.fillFromSection(
        testData.section.id,
        sourceSectionId,
        testData.section.version,
      ),
    ).rejects.toThrow("Cannot fill a section of a published report.");
    await expect(targetRows(prisma, testData)).resolves.toEqual(before);
  });

  it("fills a reopened target normally", async () => {
    const testData = await seedTestData(prisma);
    const sourceSectionId = await seedFillRows(prisma, testData);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        publishedAt,
        reopenedAt: new Date("2026-08-01T09:00:00.000Z"),
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          publishedAt,
        }),
      },
    });

    await expect(
      repo.fillFromSection(
        testData.section.id,
        sourceSectionId,
        testData.section.version,
      ),
    ).resolves.toBe(3);
    await expect(targetRows(prisma, testData)).resolves.toEqual([
      [expect.objectContaining({ text: "Source item" })],
      [expect.objectContaining({ risk: "Source risk" })],
      [expect.objectContaining({ text: "Source decision" })],
    ]);
  });

  it("keeps a submitted section unchanged when publish wins a head revoke race", async () => {
    const testData = await seedTestData(prisma);
    const submittedAt = new Date("2026-07-22T11:00:00.000Z");
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt },
    });
    const gate = createPauseGate();
    const pausedRepo = new LeadFormPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as unknown as PrismaService,
    );

    const revoke = pausedRepo.revokeSectionSubmission(
      testData.section.id,
      testData.head.id,
      groupScopeFilter(
        {
          role: "head",
          reportingGroupId: testData.head.reportingGroupId ?? undefined,
          viewerGroupAccess: [],
        },
        "reportSection",
      ),
    );
    await gate.paused;
    await publishTarget(prisma, testData);
    gate.release();
    await expect(revoke).rejects.toBeInstanceOf(LeadFormConstraintError);

    await expect(
      prisma.reportSection.findUniqueOrThrow({
        where: { id: testData.section.id },
        select: {
          status: true,
          submittedAt: true,
          revokedAt: true,
          revokedBy: true,
        },
      }),
    ).resolves.toEqual({
      status: "submitted",
      submittedAt,
      revokedAt: null,
      revokedBy: null,
    });
  });

  it("keeps submitted sections unchanged when archive wins a bulk revoke race", async () => {
    const testData = await seedTestData(prisma);
    const submittedAt = new Date("2026-07-22T11:00:00.000Z");
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt },
    });
    const gate = createPauseGate();
    const pausedRepo = new LeadFormPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as unknown as PrismaService,
    );

    const revoke = pausedRepo.revokeAllSubmitted(
      testData.report.id,
      testData.head.id,
      {},
    );
    await gate.paused;
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });
    gate.release();

    await expect(revoke).resolves.toBe(0);
    await expect(
      prisma.reportSection.findUniqueOrThrow({
        where: { id: testData.section.id },
        select: { status: true, submittedAt: true, revokedAt: true },
      }),
    ).resolves.toEqual({ status: "submitted", submittedAt, revokedAt: null });
  });

  it("does not create a reopen request when publish wins provisioning", async () => {
    const testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
    const gate = createPauseGate();
    const pausedRepo = new LeadFormPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as unknown as PrismaService,
    );

    const request = pausedRepo.createReopenRequest(
      testData.section.id,
      testData.lead.id,
      " Fix typo ",
    );
    await gate.paused;
    await publishTarget(prisma, testData);
    gate.release();

    await expect(request).rejects.toBeInstanceOf(ReopenRequestError);
    await expect(
      prisma.reopenRequest.count({
        where: { reportSectionId: testData.section.id },
      }),
    ).resolves.toBe(0);
  });

  it("leaves a request pending when publish wins its approval race", async () => {
    const testData = await seedTestData(prisma);
    const submittedAt = new Date("2026-07-22T11:00:00.000Z");
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt },
    });
    const request = await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });
    const gate = createPauseGate();
    const session: UserSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: "admin",
    };
    const decision = decideReopenRequest(
      pauseBeforeTransaction(prisma, gate.pause) as unknown as PrismaService,
      {
        id: request.id,
        decision: "approved",
        reviewNote: null,
        decidedBy: testData.head.id,
        session,
      },
    );
    await gate.paused;
    await publishTarget(prisma, testData);
    gate.release();

    await expect(decision).rejects.toBeInstanceOf(LeadFormConstraintError);
    await expect(
      prisma.reopenRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true, reviewedAt: true },
      }),
    ).resolves.toEqual({ status: "pending", reviewedAt: null });
    await expect(
      prisma.reportSection.findUniqueOrThrow({
        where: { id: testData.section.id },
        select: { status: true, submittedAt: true },
      }),
    ).resolves.toEqual({ status: "submitted", submittedAt });
  });
  // C0694: an open draft period may be deleted (cascading its sections and
  // requests) after the decision read the request but before it locks the
  // report. The request no longer exists, so the caller gets NOT_FOUND.
  it("reports NOT_FOUND when period deletion wins a decision race", async () => {
    const testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: {
        status: "submitted",
        submittedAt: new Date("2026-07-22T11:00:00.000Z"),
      },
    });
    const request = await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });
    const session: UserSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: "admin",
    };
    // Hold the author's row so the decision stops after its request read.
    const held = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${testData.lead.id} FOR UPDATE`;
      held.resolve();
      await release.promise;
    });
    await held.promise;
    const decision = decideReopenRequest(prisma as unknown as PrismaService, {
      id: request.id,
      decision: "approved",
      reviewNote: null,
      decidedBy: testData.head.id,
      session,
    });
    const settled = decision.then(
      () => undefined,
      () => undefined,
    );
    try {
      await expect
        .poll(
          async () => {
            const waiting = await prisma.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%FROM "User"%FOR NO KEY UPDATE%'`;
            return waiting[0]?.count;
          },
          { timeout: 5000 },
        )
        .toBe(1);
      await deleteReport(
        prisma as unknown as PrismaService,
        testData.report.id,
      );
    } finally {
      // Never leave the holder transaction or the blocked decision behind.
      release.resolve();
      await Promise.allSettled([holder, settled]);
    }

    await expect(decision).rejects.toBeInstanceOf(
      AdminReopenRequestNotFoundError,
    );
    await expect(
      prisma.reopenRequest.findUnique({ where: { id: request.id } }),
    ).resolves.toBeNull();
  });
});
