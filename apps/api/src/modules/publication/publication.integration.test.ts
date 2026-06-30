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

  it("saveAssembledReport updates report status to published", async () => {
    const assembled = await repo.getAssembledReport(testData.report.id);
    expect(assembled).not.toBeNull();

    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    const published = {
      ...expectDefined(assembled),
      status: "published" as const,
      publishedAt,
      publishedById: testData.head.id,
    };

    const saved = await repo.saveAssembledReport(published);

    expect(saved.status).toBe("published");
    expect(saved.publishedAt).toEqual(publishedAt);
    expect(saved.publishedById).toBe(testData.head.id);
    expect(saved.publishedByName).toBe("Test Head");

    // Verify persistence by re-reading
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).status).toBe("published");
    expect(expectDefined(reloaded).publishedById).toBe(testData.head.id);
    // refactor-period-transition-writer regression: a manual assemble-publish
    // MUST move all three lifecycle machines to published. The old
    // hand-assembled write never set periodStatus, leaving it at the default
    // "open" — which made the report invisible to viewers. The transition
    // builder fixes this.
    expect(expectDefined(reloaded).periodStatus).toBe("published");
    expect(expectDefined(reloaded).periodState).toBe("published");
    expect(expectDefined(reloaded).publishedSnapshot).not.toBeNull();
    expect(expectDefined(reloaded).publishedSnapshot).toMatchObject({
      reportId: testData.report.id,
      status: "published",
      publishedById: testData.head.id,
    });
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
