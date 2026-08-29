import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  createPauseGate,
  pauseBeforeSectionUpdate,
  pauseBeforeTransaction,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
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
      data: { archived: true },
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
      pauseBeforeSectionUpdate(prisma, gate.pause) as unknown as PrismaService,
    );

    const revoke = pausedRepo.revokeSectionSubmission(
      testData.section.id,
      testData.head.id,
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
});
