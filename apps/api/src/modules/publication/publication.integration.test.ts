import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { PublicationPrismaRepository } from "./publication.prisma-repository";

describe("PublicationPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: PublicationPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new PublicationPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("getAssembledReport returns full report with all sections", async () => {
    // Add some data to the section to make the report non-trivial
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000aa2",
        name: "Development",
        sortOrder: 3,
      },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        projectId: testData.project.id,
        stageId: stage.id,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    const result = await repo.getAssembledReport(testData.report.id);

    expect(result).not.toBeNull();
    expect(expectDefined(result).reportId).toBe(testData.report.id);
    expect(expectDefined(result).status).toBe("draft");
    expect(expectDefined(result).sections).toHaveLength(1);
    expect(expectDefined(expectDefined(result).sections[0]).authorName).toBe(
      "Test Lead 1",
    );
    expect(
      expectDefined(expectDefined(result).sections[0]).projects,
    ).toHaveLength(1);
  });

  /** Build the publish payload from the seeded draft report. */
  async function publishPayload(publishedById: string | null) {
    const assembled = await repo.getAssembledReport(testData.report.id);
    expect(assembled).not.toBeNull();
    return {
      ...expectDefined(assembled),
      status: "published" as const,
      publishedAt: new Date("2026-04-12T10:00:00.000Z"),
      publishedById,
    };
  }

  it("publishAssembledReport transitions an open period to published", async () => {
    const outcome = await repo.publishAssembledReport(
      await publishPayload(testData.head.id),
    );

    expect(outcome.status).toBe("transitioned");
    if (outcome.status === "transitioned") {
      expect(outcome.priorPeriodStatus).toBe("open");
    }
    expect(outcome.report.status).toBe("published");
    expect(outcome.report.publishedById).toBe(testData.head.id);
    expect(outcome.report.publishedByName).toBe("Test Head");

    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    // A manual publish MUST move all three lifecycle machines to published and
    // write the snapshot in the same compare-and-set statement.
    expect(expectDefined(reloaded).status).toBe("published");
    expect(expectDefined(reloaded).periodStatus).toBe("published");
    expect(expectDefined(reloaded).periodState).toBe("published");
    expect(expectDefined(reloaded).publishedById).toBe(testData.head.id);
    expect(expectDefined(reloaded).publishedSnapshot).toMatchObject({
      reportId: testData.report.id,
      status: "published",
      publishedById: testData.head.id,
    });
  });

  it("publishAssembledReport republishes a reopened period (prior status reopened)", async () => {
    // A reopened period keeps the legacy tuple (status="published") but flips
    // periodStatus to "reopened". The guard keys on periodStatus, so it stays
    // publishable and the prior status is surfaced as "reopened".
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
      },
    });

    const outcome = await repo.publishAssembledReport(
      await publishPayload(testData.head.id),
    );

    expect(outcome.status).toBe("transitioned");
    if (outcome.status === "transitioned") {
      expect(outcome.priorPeriodStatus).toBe("reopened");
    }
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).periodStatus).toBe("published");
    expect(expectDefined(reloaded).periodState).toBe("published");
  });

  it("publishAssembledReport reports already-published for a truly-published period", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
      },
    });

    const outcome = await repo.publishAssembledReport(
      await publishPayload(testData.head.id),
    );

    expect(outcome.status).toBe("already-published");
  });

  it("two concurrent publishes transition the period exactly once", async () => {
    const payload = await publishPayload(testData.head.id);

    const [first, second] = await Promise.all([
      repo.publishAssembledReport(payload),
      repo.publishAssembledReport(payload),
    ]);

    // Exactly one call transitions the row; the other observes the row already
    // published (fast-path) or a zero-row compare-and-set (raced). Either way
    // it is NOT a second transition.
    const transitions = [first, second].filter(
      (o) => o.status === "transitioned",
    );
    expect(transitions).toHaveLength(1);
    expect([first, second].every((o) => o.report.status === "published")).toBe(
      true,
    );

    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).periodStatus).toBe("published");
  });

  it("publishAssembledReport fails closed (archived) for a period archived inside the window", async () => {
    // Assemble the publish payload as the head would, THEN an admin archives the
    // period (archive leaves status="draft"/periodStatus="open", flipping only
    // archived/periodState). The pre-read above cannot catch this; the
    // `archived: false` predicate is the only point that closes the race. The
    // compare-and-set must match zero rows, the re-read shows a still-unpublished
    // row, and the outcome is "archived" — never promoting the archived row to
    // published. Before the fix the predicate matched and published it.
    const payload = await publishPayload(testData.head.id);

    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    const outcome = await repo.publishAssembledReport(payload);

    expect(outcome.status).toBe("archived");
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).status).toBe("draft");
    expect(expectDefined(reloaded).archived).toBe(true);
    expect(expectDefined(reloaded).periodState).toBe("archived");
    expect(expectDefined(reloaded).periodStatus).not.toBe("published");
    expect(expectDefined(reloaded).publishedSnapshot).toBeNull();
  });

  it("saveAutoPublishedReport writes the full autoPublish set for a non-archived draft", async () => {
    const assembled = await repo.getAssembledReport(testData.report.id);
    expect(assembled).not.toBeNull();

    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    const published = {
      ...expectDefined(assembled),
      status: "published" as const,
      publishedAt,
      publishedById: null,
    };

    const result = await repo.saveAutoPublishedReport(published);

    expect(result.published).toBe(true);
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    // The auto path used to leave periodStatus="open" and rely on a SECOND
    // transaction for autoPublished — a torn-write window. autoPublish now
    // writes the complete set in one compare-and-set update.
    expect(expectDefined(reloaded).status).toBe("published");
    expect(expectDefined(reloaded).periodStatus).toBe("published");
    expect(expectDefined(reloaded).periodState).toBe("published");
    expect(expectDefined(reloaded).autoPublished).toBe(true);
    expect(expectDefined(reloaded).publishedById).toBeNull();
  });

  it("saveAutoPublishedReport skips a row archived after candidate selection", async () => {
    // Read the candidate as the scheduler would, THEN an admin archives it
    // (archive leaves status="draft"). The compare-and-set must match zero rows
    // and leave the period archived — never promoting it to published.
    const assembled = await repo.getAssembledReport(testData.report.id);
    const published = {
      ...expectDefined(assembled),
      status: "published" as const,
      publishedAt: new Date("2026-04-12T10:00:00.000Z"),
      publishedById: null,
    };

    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    const result = await repo.saveAutoPublishedReport(published);

    expect(result).toEqual({ published: false });
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).status).toBe("draft");
    expect(expectDefined(reloaded).archived).toBe(true);
    expect(expectDefined(reloaded).periodState).toBe("archived");
    expect(expectDefined(reloaded).periodStatus).not.toBe("published");
  });
});
