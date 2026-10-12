import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper.js";
import { AdminPrismaRepository } from "./admin.prisma-repository.js";
import { AdminUserConflictError } from "./admin-errors.js";

const HISTORY_KINDS = ["acknowledgement", "verdict", "comment"] as const;

describe("admin user deletion retains live reviewer history (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as unknown as PrismaService);
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let itemId: string;
  let subject: Awaited<ReturnType<typeof createReviewer>>;
  let unrelated: Awaited<ReturnType<typeof createReviewer>>;

  function createReviewer(label: string) {
    return prisma.user.create({
      data: {
        email: `${label}@test.local`,
        samlId: label,
        name: `History ${label}`,
        lastName: "History",
        firstName: label,
        role: "head",
        reportingGroupId: expectDefined(data.head.reportingGroupId),
      },
    });
  }

  async function addHistory(
    kind: (typeof HISTORY_KINDS)[number],
    reviewerId: string,
  ): Promise<void> {
    if (kind === "acknowledgement") {
      await prisma.reviewAcknowledgement.create({
        data: {
          userId: reviewerId,
          reportId: data.report.id,
          groupId: expectDefined(data.lead.reportingGroupId),
        },
      });
    } else if (kind === "verdict") {
      await prisma.sectionReview.create({
        data: {
          reviewerId,
          reportSectionId: data.section.id,
          judgedVersion: data.section.version,
          verdict: "approved",
        },
      });
    } else {
      await prisma.recordComment.create({
        data: { reviewerId, itemId, text: "Retained review comment" },
      });
    }
  }

  async function readHistoryAndAnchors() {
    const [
      acknowledgements,
      verdicts,
      comments,
      report,
      section,
      item,
      project,
    ] = await Promise.all([
      prisma.reviewAcknowledgement.findMany({ orderBy: { id: "asc" } }),
      prisma.sectionReview.findMany({ orderBy: { id: "asc" } }),
      prisma.recordComment.findMany({ orderBy: { id: "asc" } }),
      prisma.report.findUniqueOrThrow({ where: { id: data.report.id } }),
      prisma.reportSection.findUniqueOrThrow({
        where: { id: data.section.id },
      }),
      prisma.item.findUniqueOrThrow({ where: { id: itemId } }),
      prisma.project.findUniqueOrThrow({ where: { id: data.project.id } }),
    ]);
    return {
      acknowledgements,
      verdicts,
      comments,
      report,
      section,
      item,
      project,
    };
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
    const item = await prisma.item.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        type: "current",
        text: "Review anchor",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });
    itemId = item.id;
    subject = await createReviewer("subject");
    unrelated = await createReviewer("unrelated");
    for (const kind of HISTORY_KINDS) await addHistory(kind, unrelated.id);
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it.each(HISTORY_KINDS)(
    "refuses deletion with only a live %s reference and permits deactivation",
    async (kind) => {
      await addHistory(kind, subject.id);
      expect(
        await prisma.report.count({ where: { publishedById: subject.id } }),
      ).toBe(0);
      expect(
        await prisma.reportSection.count({ where: { authorId: subject.id } }),
      ).toBe(0);
      expect(
        await prisma.project.count({ where: { leadId: subject.id } }),
      ).toBe(0);
      const before = await readHistoryAndAnchors();

      const deletion = repo.removeUser(subject.id);
      await expect(deletion).rejects.toBeInstanceOf(AdminUserConflictError);
      await expect(deletion).rejects.toThrow(
        "User is referenced by existing records; deactivate the user instead.",
      );
      await expect(
        prisma.user.delete({ where: { id: subject.id } }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toEqual(subject);
      expect(await readHistoryAndAnchors()).toEqual(before);
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);

      await repo.deactivateUser(subject.id);
      await expect(repo.removeUser(subject.id)).rejects.toBeInstanceOf(
        AdminUserConflictError,
      );
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toMatchObject({ id: subject.id, isActive: false });
      expect(await readHistoryAndAnchors()).toEqual(before);
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);
    },
  );

  it("deletes only a reference-free user and leaves unrelated history intact", async () => {
    const before = await readHistoryAndAnchors();
    await repo.removeUser(subject.id);
    expect(
      await prisma.user.findUnique({ where: { id: subject.id } }),
    ).toBeNull();
    expect(
      await prisma.user.findUnique({ where: { id: unrelated.id } }),
    ).toEqual(unrelated);
    expect(await readHistoryAndAnchors()).toEqual(before);
  });
});
