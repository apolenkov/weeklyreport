// Automatic publication against a concurrent section save, on real
// PostgreSQL (openspec: lead-incomplete-record-drafts, task 4.1). A save that
// commits after the publisher read the graph aborts that publication; the
// retry freezes the saved state, content and omission totals alike. A
// publisher that already won closes the save.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { ReportSectionsService } from "../../report-sections/application/report-sections.service.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../../report-sections/application/report-sections-telemetry.port.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/test-seams/index.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository.js";

const STAGE_ID = "a0000000-0000-4000-a000-000000000ac1";

// No sleeps: the real publisher is paused right after its graph read or right
// after its winning lifecycle CAS. Every other query is real.
function barrier() {
  const reached = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  return {
    reached: reached.promise,
    release: () => released.resolve(),
    pause: async () => {
      reached.resolve();
      await released.promise;
    },
  };
}

describe("automatic publication versus a section save (PostgreSQL)", () => {
  const prisma = createTestPrisma();
  const realRepo = new PublicationPrismaRepository(prisma as PrismaService);
  const sections = new ReportSectionsService(
    new ReportSectionsPrismaRepository(prisma as unknown as PrismaService),
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
  let fixture: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    fixture = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: fixture.lead.id,
        stageId: STAGE_ID,
        projectId: fixture.project.id,
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  const risk = (name: string, impact: string | null) => ({
    projectId: fixture.project.id,
    risk: name,
    impact,
    mitigation: impact === null ? null : "Second vendor",
    severity: "at-risk" as const,
    stageNames: ["Development"],
  });

  // One finished and one unfinished risk, saved by the section's author.
  const saveTwoRisks = () =>
    sections.saveDraft(
      {
        reportSectionId: fixture.section.id,
        version: 1,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [risk("Finished", "Date slips"), risk("Unfinished", null)],
        decisions: [],
      } as never,
      fixture.lead.id,
    );

  async function candidate() {
    const report = expectDefined(
      await realRepo.getAssembledReport(fixture.report.id),
    );
    return {
      ...report,
      status: "published" as const,
      publishedAt: new Date("2026-04-12T10:00:00.000Z"),
      publishedById: null,
    };
  }

  function pausedRepo(point: "read" | "cas", gate: ReturnType<typeof barrier>) {
    const client = prisma.$extends({
      query: {
        report: {
          async findUnique({ args, query }) {
            const row = await query(args);
            if (point === "read") await gate.pause();
            return row;
          },
          async updateMany({ args, query }) {
            const result = await query(args);
            if (point === "cas") await gate.pause();
            return result;
          },
        },
      },
    });
    return new PublicationPrismaRepository(client as unknown as PrismaService);
  }

  const frozen = async () => ({
    report: await prisma.report.findUniqueOrThrow({
      where: { id: fixture.report.id },
    }),
    scopes: await prisma.publishedSectionScope.findMany({
      where: { reportId: fixture.report.id },
      select: { omittedRisks: true, omittedDecisions: true },
    }),
  });

  it("aborts when a save commits after its graph read, then freezes the saved state on retry", async () => {
    const input = await candidate();
    const gate = barrier();
    const publishing = pausedRepo("read", gate)
      .saveAutoPublishedReport(input)
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    try {
      await gate.reached;
      await saveTwoRisks();
    } finally {
      gate.release();
    }

    // A publication of the graph read before the save is never acceptable.
    expect(await publishing).toMatchObject({ error: { code: "P2034" } });
    expect(await frozen()).toMatchObject({
      report: {
        status: "draft",
        periodStatus: "open",
        publishedSnapshot: null,
      },
      scopes: [],
    });

    // The scheduler's next tick: one state for content and totals alike.
    await expect(
      realRepo.saveAutoPublishedReport(input),
    ).resolves.toMatchObject({ published: true });
    const after = await frozen();
    expect(after.report).toMatchObject({
      status: "published",
      periodState: "published",
      periodStatus: "published",
      autoPublished: true,
    });
    expect(after.report.publishedSnapshot).toMatchObject({
      sections: [{ risks: [{ risk: "Finished" }] }],
    });
    expect(after.scopes).toEqual([{ omittedRisks: 1, omittedDecisions: 0 }]);
  });

  it("closes a save that arrives after the publisher won, with nothing written", async () => {
    const input = await candidate();
    const gate = barrier();
    const publication = pausedRepo("cas", gate)
      .saveAutoPublishedReport(input)
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    let saving: ReturnType<typeof saveTwoRisks> | undefined;
    try {
      await gate.reached;
      saving = saveTwoRisks();
      void saving.catch(() => undefined);
    } finally {
      gate.release();
    }

    expect(await publication).toMatchObject({ value: { published: true } });
    await expect(saving).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
    expect(await prisma.risk.count()).toBe(0);
    const after = await frozen();
    expect(after.report.publishedSnapshot).toMatchObject({
      sections: [{ risks: [] }],
    });
    expect(after.scopes).toEqual([{ omittedRisks: 0, omittedDecisions: 0 }]);
    expect(
      await prisma.reportSection.findUniqueOrThrow({
        where: { id: fixture.section.id },
        select: { version: true },
      }),
    ).toEqual({ version: 1 });
  });
});
