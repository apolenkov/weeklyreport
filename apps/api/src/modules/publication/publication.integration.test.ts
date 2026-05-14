import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { PublicationPrismaRepository } from "./publication.prisma-repository";
import { expectDefined } from "../../test-utils/expect-defined.js";

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

    await prisma.priority.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        rank: 1,
        text: "Top priority",
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
    expect(
      expectDefined(expectDefined(result).sections[0]).priorities,
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
    expect(expectDefined(reloaded).publishedSnapshot).not.toBeNull();
    expect(expectDefined(reloaded).publishedSnapshot).toMatchObject({
      reportId: testData.report.id,
      status: "published",
      publishedById: testData.head.id,
    });
  });
});
