import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { PeriodPrismaRepository } from "../../period/infrastructure/period.prisma-repository.js";
import { insertCoordinatedLeadItemComment } from "../../review/infrastructure/review-actions.comment-write.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository.js";

// No sleeps: the real publisher is paused immediately after its graph query
// or immediately after its winning lifecycle CAS. Every other query is real.
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

describe("automatic publication comment write fence (PostgreSQL)", () => {
  const prisma = createTestPrisma();
  const realRepo = new PublicationPrismaRepository(prisma as PrismaService);
  let fixture: Awaited<ReturnType<typeof seedTestData>>;
  let itemId: string;

  beforeEach(async () => {
    await cleanDatabase();
    fixture = await seedTestData(prisma);
    const item = await prisma.item.create({
      data: {
        reportSectionId: fixture.section.id,
        projectId: fixture.project.id,
        type: "current",
        text: "Publication fence fixture",
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  function reply() {
    return insertCoordinatedLeadItemComment(
      prisma as PrismaService,
      { userId: fixture.lead.id, role: "lead" },
      itemId,
      "Committed Lead reply",
    );
  }

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

  it("aborts an older repeatable-read publication when a reply commits before CAS, then retries fresh", async () => {
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
      const comment = await reply();
      expect(comment.text).toBe("Committed Lead reply");
    } finally {
      gate.release();
    }
    const outcome = await publishing;
    // Prisma maps PostgreSQL's concurrent-update serialization failure to
    // P2034. Successful publication from the old graph is never acceptable.
    expect(outcome).toMatchObject({ error: { code: "P2034" } });
    const unchanged = await prisma.report.findUniqueOrThrow({
      where: { id: fixture.report.id },
    });
    expect(unchanged).toMatchObject({
      status: "draft",
      periodState: "open",
      periodStatus: "open",
      autoPublished: false,
      publishedSnapshot: null,
    });
    expect(
      await prisma.publishedSearchDocument.count({
        where: { reportId: fixture.report.id },
      }),
    ).toBe(0);
    expect(
      await prisma.publishedSectionScope.count({
        where: { reportId: fixture.report.id },
      }),
    ).toBe(0);
    const retry = await realRepo.saveAutoPublishedReport(input);
    expect(retry).toMatchObject({
      published: true,
      report: {
        sections: [
          { items: [{ comments: [{ text: "Committed Lead reply" }] }] },
        ],
      },
    });
    const frozen = await prisma.report.findUniqueOrThrow({
      where: { id: fixture.report.id },
    });
    expect(frozen.publishedSnapshot).toMatchObject({
      sections: [{ items: [{ comments: [{ text: "Committed Lead reply" }] }] }],
    });
  });

  it("rejects a reply after the publisher wins CAS without deadlocking", async () => {
    const input = await candidate();
    const gate = barrier();
    const publishing = pausedRepo("cas", gate).saveAutoPublishedReport(input);
    // Observe rejection immediately even if an assertion below fails.
    const publication = publishing.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let replying: ReturnType<typeof reply> | undefined;
    try {
      await gate.reached;
      replying = reply();
      void replying.catch(() => undefined);
    } finally {
      gate.release();
    }
    expect(await publication).toMatchObject({ value: { published: true } });
    await expect(replying).rejects.toMatchObject({
      name: "ReviewNotFoundError",
      message: "Record not found.",
    });
    expect(await prisma.recordComment.count()).toBe(0);
  });

  it("retains manual submitted-section admission and automatic draft-section admission", async () => {
    const manual = new PeriodPrismaRepository(
      prisma as PrismaService,
      {} as never,
    );
    const expected = expectDefined(
      await manual.getReportById(fixture.report.id),
    );
    await expect(
      manual.publishPeriod(fixture.report.id, fixture.head.id, expected),
    ).rejects.toThrow("submitted");
    const input = await candidate();
    await expect(
      realRepo.saveAutoPublishedReport(input),
    ).resolves.toMatchObject({
      published: true,
    });
  });
});
