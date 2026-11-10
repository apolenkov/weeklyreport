// A decision that a publication froze keeps its Impact and its place through
// reopen and republish; a decision no publication holds may still be left
// unfinished (openspec: lead-incomplete-record-drafts, task 3.6).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../../period/infrastructure/period.prisma-repository";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import { ReportSectionsService } from "../application/report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const STAGE_ID = "a0000000-0000-4000-a000-000000000ab1";
const PUBLISHED_DECISION = "b0000000-0000-4000-a000-000000000bd1";
const NEW_DECISION = "b0000000-0000-4000-a000-000000000bd2";
const STAGES = ["Development"];

describe("saveSection (integration) — a published decision keeps its Impact", () => {
  const prisma = createTestPrisma();
  const periods = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );
  let service: ReportSectionsService;
  let data: Awaited<ReturnType<typeof seedTestData>>;

  const decision = (stableId: string, impact: string | null) => ({
    stableId,
    text: "Choose the vendor",
    owner: "Lead",
    impact,
    stageNames: STAGES,
    productId: data.project.id,
  });

  const stored = async () => {
    const section = await prisma.reportSection.findUniqueOrThrow({
      where: { id: data.section.id },
      select: {
        version: true,
        decisions: {
          orderBy: { stableId: "asc" },
          select: { id: true, stableId: true, impact: true },
        },
      },
    });
    const comments = await prisma.recordComment.findMany({
      select: { id: true, decisionId: true, text: true },
    });
    return { ...section, comments };
  };

  const save = async (decisions: readonly object[]) =>
    service.saveDraft(
      {
        reportSectionId: data.section.id,
        version: (await stored()).version,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [],
        decisions,
      } as never,
      data.lead.id,
    );

  const lifecycle = async () => {
    const state = await periods.getReportById(data.report.id);
    if (!state) throw new Error("Report fixture is missing.");
    return state;
  };

  const setSectionStatus = (status: "draft" | "submitted") =>
    prisma.reportSection.update({
      where: { id: data.section.id },
      data: { status },
    });

  // Submit, publish, reopen, and hand the section back to its author.
  const publishThenReopen = async () => {
    await setSectionStatus("submitted");
    await expect(
      periods.publishPeriod(data.report.id, data.head.id, await lifecycle()),
    ).resolves.toEqual({ transitioned: true });
    await periods.reopenPeriod(data.report.id, await lifecycle(), {
      enforceSingleReopen: false,
    });
    await setSectionStatus("draft");
  };

  const expectLocked = async (
    decisions: readonly object[],
    message: RegExp,
  ) => {
    const before = await stored();
    await expect(save(decisions)).rejects.toMatchObject({
      code: "PUBLISHED_RECORD_LOCKED",
      message: expect.stringMatching(message) as unknown,
    });
    expect(await stored()).toEqual(before);
  };

  beforeAll(() => {
    service = new ReportSectionsService(
      new ReportSectionsPrismaRepository(prisma as unknown as PrismaService),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: data.lead.id,
        stageId: STAGE_ID,
        projectId: data.project.id,
      },
    });
    await save([decision(PUBLISHED_DECISION, "Budget moves to Q3")]);
    const [row] = (await stored()).decisions;
    if (!row) throw new Error("Decision fixture is missing.");
    await prisma.recordComment.create({
      data: {
        reviewerId: data.head.id,
        decisionId: row.id,
        text: "Agreed in review",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("lets a never-published decision lose its Impact or be dropped", async () => {
    await save([
      decision(PUBLISHED_DECISION, null),
      decision(NEW_DECISION, "Costs rise"),
    ]);
    expect((await stored()).decisions).toMatchObject([
      { stableId: PUBLISHED_DECISION, impact: null },
      { stableId: NEW_DECISION, impact: "Costs rise" },
    ]);

    // A finished decision no publication holds may simply be left out.
    await save([decision(PUBLISHED_DECISION, null)]);
    expect((await stored()).decisions).toMatchObject([
      { stableId: PUBLISHED_DECISION, impact: null },
    ]);
  });

  it("refuses to clear or drop it after publish and reopen, and again after republish", async () => {
    await publishThenReopen();

    await expectLocked(
      [decision(PUBLISHED_DECISION, null)],
      /Impact cannot be left empty/u,
    );

    // The second publication keeps the finished decision…
    await save([decision(PUBLISHED_DECISION, "Budget moves to Q4")]);
    await publishThenReopen();

    // …so it can be neither dropped nor emptied afterwards.
    await expectLocked([], /cannot be deleted/u);
    await expectLocked(
      [decision(PUBLISHED_DECISION, null)],
      /Impact cannot be left empty/u,
    );
    expect(await stored()).toMatchObject({
      decisions: [
        { stableId: PUBLISHED_DECISION, impact: "Budget moves to Q4" },
      ],
      comments: [{ text: "Agreed in review" }],
    });
  });
});
