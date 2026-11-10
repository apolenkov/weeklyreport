// A freeze that fails part-way leaves the published snapshot and its frozen
// omission totals exactly as the last successful publication wrote them
// (openspec: lead-incomplete-record-drafts, task 4.2).
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { freezePublishedSnapshot } from "../../search/index.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import { PeriodPrismaRepository } from "./period.prisma-repository";

describe("published omission totals rollback (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );

  const REPORT = "f0000000-0000-4000-a000-0000000000e1";
  const USER = "00000000-0000-4000-8000-0000000000e9";
  const GROUP = "f0000000-0000-4000-a000-0000000000e2";
  const PROJECT = "f0000000-0000-4000-a000-0000000000e3";

  let sectionId = "";

  const unfinishedRisk = (risk: string) => ({
    reportSectionId: sectionId,
    projectId: PROJECT,
    risk,
    impact: null,
    mitigation: null,
    severity: "at-risk",
    stageNames: ["Development"],
  });

  const frozen = async () => ({
    scopes: await prisma.publishedSectionScope.findMany({
      where: { reportId: REPORT },
    }),
    snapshot: (
      await prisma.report.findUniqueOrThrow({
        where: { id: REPORT },
        select: { publishedSnapshot: true },
      })
    ).publishedSnapshot,
  });

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({
      data: { id: GROUP, name: "Rollback Group" },
    });
    await prisma.user.create({
      data: {
        id: USER,
        email: "head-omission-rollback@test.local",
        name: "Rollback Head",
        lastName: "Head",
        firstName: "Rollback",
        role: "head",
        samlId: "head-omission-rollback",
        reportingGroupId: GROUP,
      },
    });
    await prisma.project.create({
      data: { id: PROJECT, name: "Rollback Project", leadId: USER },
    });
    await prisma.groupProduct.create({
      data: { groupId: GROUP, productId: PROJECT },
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
    const section = await prisma.reportSection.create({
      data: { reportId: REPORT, authorId: USER, status: "submitted" },
    });
    sectionId = section.id;
    await prisma.risk.create({ data: unfinishedRisk("First unfinished") });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("keeps the last published totals and snapshot when a later freeze fails", async () => {
    const state = await repository.getReportById(REPORT);
    if (!state) throw new Error("Report fixture is missing.");
    await expect(
      repository.publishPeriod(REPORT, USER, state),
    ).resolves.toEqual({ transitioned: true });

    const before = await frozen();
    expect(before.scopes).toEqual([
      expect.objectContaining({
        reportSectionId: sectionId,
        omittedRisks: 1,
        omittedDecisions: 0,
      }),
    ]);

    await prisma.risk.create({ data: unfinishedRisk("Second unfinished") });

    await expect(
      prisma.$transaction(async (tx) => {
        await freezePublishedSnapshot(tx, REPORT);
        // The failed freeze did see and write the new total.
        await expect(
          tx.publishedSectionScope.findMany({ where: { reportId: REPORT } }),
        ).resolves.toEqual([expect.objectContaining({ omittedRisks: 2 })]);
        throw new Error("intentional freeze rollback");
      }),
    ).rejects.toThrow("intentional freeze rollback");

    expect(await frozen()).toEqual(before);
  });
});
