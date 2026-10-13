import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper";
import { PublicationService } from "../application/publication.service.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository";

describe("PublicationPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: PublicationPrismaRepository;
  let service: PublicationService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new PublicationPrismaRepository(prisma as unknown as PrismaService);
    service = new PublicationService(repo, createNullLogger(), () =>
      Promise.resolve(),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("scopes preview sections and portfolio while internal publication retains every group", async () => {
    const groupB = await prisma.reportingGroup.create({
      data: { name: "Group B" },
    });
    const leadB = await prisma.user.create({
      data: {
        email: "preview-b@test.local",
        name: "Lead B",
        lastName: "Lead",
        firstName: "B",
        role: "lead",
        samlId: "preview-lead-b",
        reportingGroupId: groupB.id,
      },
    });
    const sectionB = await prisma.reportSection.create({
      data: { reportId: testData.report.id, authorId: leadB.id },
    });
    const projectB = await prisma.project.create({
      data: { name: "Product B", leadId: leadB.id },
    });
    await prisma.groupProduct.create({
      data: { groupId: groupB.id, productId: projectB.id },
    });
    const stage = await prisma.stage.create({
      data: { name: "Development", sortOrder: 3 },
    });
    const sharedStageB = await prisma.stage.create({
      data: { name: "Support", sortOrder: 4 },
    });
    await prisma.stageAssignment.createMany({
      data: [
        {
          userId: testData.lead.id,
          projectId: testData.project.id,
          stageId: stage.id,
        },
        { userId: leadB.id, projectId: projectB.id, stageId: stage.id },
        // Shared product is green for A, red for B; only visible contributions count.
        {
          userId: leadB.id,
          projectId: testData.project.id,
          stageId: sharedStageB.id,
        },
      ],
    });
    await prisma.projectStatus.createMany({
      data: [
        {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          status: "green",
        },
        {
          reportSectionId: sectionB.id,
          projectId: projectB.id,
          status: "yellow",
        },
        {
          reportSectionId: sectionB.id,
          projectId: testData.project.id,
          status: "red",
        },
      ],
    });
    const headSession: UserSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: "head",
      reportingGroupId: expectDefined(testData.head.reportingGroupId),
    };

    const preview = await service.getAssembledPreview(
      testData.report.id,
      headSession,
    );
    expect(
      preview.sections.map(({ reportSectionId }) => reportSectionId),
    ).toEqual([testData.section.id]);
    expect(preview.portfolioOverview).toEqual({
      status: "green",
      totals: { green: 1, yellow: 0, red: 0 },
    });

    const groupless = await service.getAssembledPreview(testData.report.id, {
      ...headSession,
      reportingGroupId: undefined,
    });
    expect(groupless.sections).toEqual([]);
    expect(groupless.portfolioOverview).toEqual({
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    });

    const full = await service.getAssembledReport(testData.report.id);
    expect(
      full.sections.map(({ reportSectionId }) => reportSectionId).sort(),
    ).toEqual([testData.section.id, sectionB.id].sort());
    expect(full.portfolioOverview).toEqual({
      status: "red",
      totals: { green: 0, yellow: 1, red: 1 },
    });
    expect(
      await service.getAssembledPreview(testData.report.id, {
        ...headSession,
        role: "admin",
        reportingGroupId: undefined,
      }),
    ).toEqual(full);

    const outcome = await service.publishAuto(
      testData.report.id,
      new Date("2026-04-12T10:00:00.000Z"),
    );
    expect(outcome).toMatchObject({
      published: true,
      report: {
        sections: full.sections,
        portfolioOverview: full.portfolioOverview,
      },
    });
  });

  it("getAssembledReport returns full report with all sections", async () => {
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

  it("orders sections by author name and keeps the order stable across reads", async () => {
    const additionalLeads = [
      {
        id: "a0000000-0000-4000-a000-000000000011",
        email: "zeta-lead@test.local",
        name: "Zeta Lead",
        lastName: "Lead",
        firstName: "Zeta",
        role: "lead" as const,
        samlId: "zeta-lead-test",
        reportingGroupId: testData.lead.reportingGroupId,
      },
      {
        id: "a0000000-0000-4000-a000-000000000012",
        email: "alpha-lead@test.local",
        name: "Alpha Lead",
        lastName: "Lead",
        firstName: "Alpha",
        role: "lead" as const,
        samlId: "alpha-lead-test",
        reportingGroupId: testData.lead.reportingGroupId,
      },
      {
        id: "a0000000-0000-4000-a000-000000000013",
        email: "mike-lead@test.local",
        name: "Mike Lead",
        lastName: "Lead",
        firstName: "Mike",
        role: "lead" as const,
        samlId: "mike-lead-test",
        reportingGroupId: testData.lead.reportingGroupId,
      },
    ];
    await prisma.user.createMany({ data: additionalLeads });
    await Promise.all(
      additionalLeads.map((lead) =>
        prisma.reportSection.create({
          data: { reportId: testData.report.id, authorId: lead.id },
        }),
      ),
    );

    const firstRead = expectDefined(
      await service.getAssembledReport(testData.report.id),
    );
    const secondRead = expectDefined(
      await service.getAssembledReport(testData.report.id),
    );
    const firstAuthorNames = firstRead.sections.map(
      (section) => section.authorName,
    );
    const secondAuthorNames = secondRead.sections.map(
      (section) => section.authorName,
    );

    expect(firstAuthorNames).toEqual([
      "Alpha Lead",
      "Mike Lead",
      "Test Lead 1",
      "Zeta Lead",
    ]);
    expect(secondAuthorNames).toEqual(firstAuthorNames);

    const published = await repo.saveAutoPublishedReport({
      ...firstRead,
      status: "published",
      publishedAt: new Date("2026-04-12T10:00:00.000Z"),
      publishedById: null,
    });

    expect(published.published).toBe(true);
    if (published.published) {
      expect(
        published.report.sections.map(({ authorName }) => authorName),
      ).toEqual(firstAuthorNames);
    }
    await expect(
      prisma.report.findUnique({
        where: { id: testData.report.id },
        select: { publishedSnapshot: true },
      }),
    ).resolves.toMatchObject({
      publishedSnapshot: {
        sections: firstAuthorNames.map((authorName) => ({ authorName })),
      },
    });
  });

  it("saveAutoPublishedReport writes the full autoPublish set for a non-archived draft", async () => {
    const frozenItem = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "auto projection publication",
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
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
    // autoPublish writes status/periodStatus/periodState/autoPublished in one CAS.
    expect(expectDefined(reloaded).status).toBe("published");
    expect(expectDefined(reloaded).periodStatus).toBe("published");
    expect(expectDefined(reloaded).periodState).toBe("published");
    expect(expectDefined(reloaded).autoPublished).toBe(true);
    expect(expectDefined(reloaded).publishedById).toBeNull();
    await expect(
      prisma.publishedSearchDocument.findMany({
        where: { reportId: testData.report.id },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        recordId: frozenItem.id,
        title: "auto projection publication",
        groupId: TEST_IDS.group,
      }),
    ]);
  });

  it("saveAutoPublishedReport freezes the snapshot from a fresh in-transaction re-read (captures a lead edit committed after assemble)", async () => {
    // The scheduler pre-reads the payload, then a lead commits an edit before
    // the guarded write lands. The frozen snapshot MUST reflect it — built from
    // a fresh in-transaction re-read, never the earlier assemble-read.
    const assembled = await repo.getAssembledReport(testData.report.id);
    expect(expectDefined(assembled).sections[0]?.status).toBe("draft");
    const published = {
      ...expectDefined(assembled),
      status: "published" as const,
      publishedAt: new Date("2026-04-12T10:00:00.000Z"),
      publishedById: null,
    };

    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: {
        status: "submitted",
        submittedAt: new Date("2026-04-11T09:00:00.000Z"),
      },
    });

    const result = await repo.saveAutoPublishedReport(published);

    expect(result.published).toBe(true);
    const reloaded = await prisma.report.findUnique({
      where: { id: testData.report.id },
    });
    expect(expectDefined(reloaded).publishedSnapshot).toMatchObject({
      sections: [{ status: "submitted" }],
    });
    if (result.published) {
      expect(expectDefined(result.report.sections[0]).status).toBe("submitted");
    }
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

  it.each([
    ["moved to a future deadline", new Date("2026-05-01T10:00:00.000Z")],
    ["cleared deadline", null],
  ])(
    "saveAutoPublishedReport skips when the deadline is %s after candidate selection",
    async (_description, currentDeadline) => {
      const assembled = await repo.getAssembledReport(testData.report.id);
      const selectedDeadline = expectDefined(assembled).deadline;
      expect(selectedDeadline).not.toBeNull();
      const published = {
        ...expectDefined(assembled),
        status: "published" as const,
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: null,
      };

      // Model an admin edit after the scheduler selected the overdue row.
      await prisma.report.update({
        where: { id: testData.report.id },
        data: { deadline: currentDeadline },
      });

      const result = await repo.saveAutoPublishedReport(
        published,
        expectDefined(selectedDeadline),
      );

      expect(result).toEqual({ published: false });
      const reloaded = await prisma.report.findUnique({
        where: { id: testData.report.id },
      });
      expect(expectDefined(reloaded).status).toBe("draft");
      expect(expectDefined(reloaded).publishedSnapshot).toBeNull();
      expect(expectDefined(reloaded).deadline).toEqual(currentDeadline);
    },
  );
});
