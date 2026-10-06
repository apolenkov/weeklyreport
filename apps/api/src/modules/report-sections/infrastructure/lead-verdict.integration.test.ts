import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { ReportSectionsService } from "../application/report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import {
  assignOutcomeStage,
  OUTCOME_STAGE,
  seedOutcomeItem,
  seedPriorPlan,
  unchangedDraftPayload,
} from "./item-outcome.integration.fixtures";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

// The web client expresses a plan verdict on a linked occurrence, and "Confirm
// all as continue", as ordinary draft saves of the selected week.
describe("lead plan verdicts through the draft save (real database)", () => {
  const prisma = createTestPrisma();
  const prismaService = prisma as unknown as PrismaService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let repository: ReportSectionsPrismaRepository;
  let ordinarySave: ReportSectionsService;

  beforeAll(() => {
    repository = new ReportSectionsPrismaRepository(prismaService);
    ordinarySave = new ReportSectionsService(
      repository,
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await assignOutcomeStage(prisma, testData);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  function seedCarried(text: string, priorityRank: number) {
    return prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text,
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: true,
        priorityRank,
        stageNames: [OUTCOME_STAGE.name],
      },
    });
  }

  async function loadSection() {
    return expectDefined(await repository.getSectionById(testData.section.id));
  }

  it("confirms every carried continuation in one save without adding or dropping records", async () => {
    await Promise.all([
      seedCarried("Carried continuation 1", 1),
      seedCarried("Carried continuation 2", 2),
      seedCarried("Carried continuation 3", 3),
    ]);
    await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
      text: "Already confirmed",
    });
    const before = await loadSection();
    expect(before.items.filter((item) => item.carriedOver)).toHaveLength(3);

    const payload = unchangedDraftPayload(before);
    const saved = await ordinarySave.saveDraft(
      {
        ...payload,
        items: payload.items.map((item) => ({ ...item, carriedOver: false })),
      },
      testData.lead.id,
    );

    expect(saved.version).toBe(before.version + 1);
    expect(saved.items).toHaveLength(4);
    expect(saved.items.every((item) => !item.carriedOver)).toBe(true);
    const stableIds = saved.items.map((item) => item.stableId);
    expect(new Set(stableIds).size).toBe(4);
    expect([...stableIds].sort()).toEqual(
      before.items.map((item) => item.stableId).sort(),
    );
    await expect(
      prisma.item.count({
        where: { reportSectionId: testData.section.id, carriedOver: true },
      }),
    ).resolves.toBe(0);
  });

  it("applies a verdict to the linked occurrence and leaves the prior week untouched", async () => {
    const prior = await seedPriorPlan(prisma, testData);
    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        stableId: prior.item.stableId,
        type: "current",
        text: "Published prior promise",
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: true,
        priorityRank: 1,
        stageNames: [OUTCOME_STAGE.name],
      },
    });
    const before = await loadSection();

    const payload = unchangedDraftPayload(before);
    const saved = await ordinarySave.saveDraft(
      {
        ...payload,
        items: payload.items.map((item) =>
          item.stableId === prior.item.stableId
            ? {
                ...item,
                workflowStatus: "paused" as const,
                pausedReason: "Waiting for the vendor",
                carriedOver: false,
              }
            : item,
        ),
      },
      testData.lead.id,
    );

    const occurrences = saved.items.filter(
      (item) => item.stableId === prior.item.stableId,
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      type: "current",
      workflowStatus: "paused",
      pausedReason: "Waiting for the vendor",
      carriedOver: false,
    });

    const [priorReport, priorItem, nextOccurrences] = await Promise.all([
      prisma.report.findUniqueOrThrow({
        where: { id: prior.report.id },
        select: { publishedSnapshot: true },
      }),
      prisma.item.findUniqueOrThrow({ where: { id: prior.item.id } }),
      prisma.item.count({
        where: {
          reportSectionId: testData.section.id,
          stableId: prior.item.stableId,
          type: "next",
        },
      }),
    ]);
    expect(priorReport.publishedSnapshot).toEqual(prior.snapshot);
    expect(priorItem).toMatchObject({
      id: prior.item.id,
      type: "next",
      workflowStatus: "postponed",
      text: "Drifted live row",
    });
    expect(nextOccurrences).toBe(0);
  });
});
