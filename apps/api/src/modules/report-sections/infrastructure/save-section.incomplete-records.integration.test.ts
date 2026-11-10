import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { ReportSectionsService } from "../application/report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const STAGE_ID = "a0000000-0000-4000-a000-000000000aa1";
const RISK_STABLE_ID = "b0000000-0000-4000-a000-000000000bb1";
const STAGES = ["Development"];

describe("saveSection (integration) — stored incomplete records", () => {
  const prisma = createTestPrisma();
  let service: ReportSectionsService;
  let repo: ReportSectionsPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  const draft = (records: object = {}) => ({
    reportSectionId: testData.section.id,
    version: 1,
    status: "draft" as const,
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: [],
    items: [],
    risks: [],
    decisions: [],
    ...records,
  });

  const keptRisk = (details: { impact: string | null }) => ({
    stableId: RISK_STABLE_ID,
    projectId: testData.project.id,
    risk: "Vendor may slip",
    mitigation: null,
    severity: "at-risk" as const,
    stageNames: STAGES,
    ...details,
  });

  // The stored state a rejected save must leave exactly as it found it.
  async function storedState() {
    const section = await prisma.reportSection.findUniqueOrThrow({
      where: { id: testData.section.id },
      select: {
        version: true,
        risks: { select: { id: true, stableId: true, impact: true } },
      },
    });
    const comments = await prisma.recordComment.findMany({
      select: { id: true, riskId: true },
    });
    return { ...section, comments };
  }

  beforeAll(() => {
    // The integration client crosses the repository's PrismaService injection
    // boundary through this test-only cast.
    repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    service = new ReportSectionsService(
      repo,
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: STAGE_ID,
        projectId: testData.project.id,
      },
    });
    const risk = await prisma.risk.create({
      data: {
        stableId: RISK_STABLE_ID,
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Vendor may slip",
        impact: null,
        mitigation: null,
        severity: "at-risk",
        stageNames: STAGES,
      },
    });
    await prisma.recordComment.create({
      data: {
        reviewerId: testData.head.id,
        riskId: risk.id,
        text: "Keep this context",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("rolls a save that omits the draft back: version, rows and comments stay", async () => {
    const before = await storedState();

    await expect(
      service.saveDraft(draft(), testData.lead.id),
    ).rejects.toMatchObject({ code: "INCOMPLETE_RECORD_OMITTED" });

    expect(await storedState()).toEqual(before);
    expect(before.version).toBe(1);
  });

  it("rolls an invalid deletion intent back the same way", async () => {
    const before = await storedState();

    await expect(
      service.saveDraft(
        draft({
          deletedIncompleteRecords: [
            { kind: "decision", stableId: RISK_STABLE_ID },
          ],
        }),
        testData.lead.id,
      ),
    ).rejects.toMatchObject({ code: "INCOMPLETE_RECORD_DELETION_INVALID" });

    expect(await storedState()).toEqual(before);
  });

  it("shows the draft to its author only and keeps it across a save", async () => {
    const saved = await service.saveDraft(
      draft({ risks: [keptRisk({ impact: null })] }),
      testData.lead.id,
    );

    expect(saved.risks).toMatchObject([
      { stableId: RISK_STABLE_ID, impact: null, mitigation: null },
    ]);
    const shared = await repo.getSectionById(testData.section.id);
    expect(shared?.risks).toEqual([]);
    expect((await storedState()).comments).toHaveLength(1);
  });

  it("deletes the draft on an explicit intent", async () => {
    const saved = await service.saveDraft(
      draft({
        deletedIncompleteRecords: [{ kind: "risk", stableId: RISK_STABLE_ID }],
      }),
      testData.lead.id,
    );

    expect(saved.version).toBe(2);
    expect((await storedState()).risks).toEqual([]);
  });

  it("refuses to submit while the draft is stored and omitted", async () => {
    const before = await storedState();

    await expect(
      repo.saveSection(
        {
          ...(await service.getActiveSection(
            testData.section.id,
            testData.section.authorId,
          )),
          status: "submitted",
        },
        1,
      ),
    ).rejects.toMatchObject({ code: "INCOMPLETE_RECORD_OMITTED" });

    expect(await storedState()).toEqual(before);
  });
});
