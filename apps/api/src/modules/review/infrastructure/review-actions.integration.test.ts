import type { UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper";
import {
  CarryOverPrismaRepository,
  CarryOverService,
} from "../../carry-over/index.js";
import { applyRevokeTransition } from "../../report-sections/index.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/test-seams/index.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import { ReviewActionsService } from "../application/review-actions.service";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository";

const STABLE_A = "aaaa1111-0000-4000-8000-00000000aaaa";

describe("review-actions (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ReviewActionsPrismaRepository;
  let sectionsRepo: ReportSectionsPrismaRepository;
  let service: ReviewActionsService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  // A second distinct reviewer for the concurrency + race tests.
  let admin: { id: string };

  beforeAll(() => {
    repo = new ReviewActionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    sectionsRepo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    service = new ReviewActionsService(repo);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    admin = await prisma.user.create({
      data: {
        email: "admin@test.local",
        name: "Admin",
        lastName: "Admin",
        firstName: "A",
        role: "admin",
        samlId: "admin-test",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function seedItem(stableId = STABLE_A, text = "Ship it") {
    return prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        stableId,
        projectId: testData.project.id,
        type: "current",
        text,
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });
  }

  async function commentsForSection(): Promise<
    { id: string; itemId: string | null; text: string }[]
  > {
    return prisma.recordComment.findMany({
      where: { item: { reportSectionId: testData.section.id } },
      select: { id: true, itemId: true, text: true },
    });
  }

  async function setSubmitted() {
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
  }

  describe("comment-aware saveSection", () => {
    it("preserves a comment across a re-save, re-anchored to the recreated record", async () => {
      const item = await seedItem();
      await repo.insertComment(
        {
          userId: testData.head.id,
          role: "head",
          reportingGroupId: expectDefined(testData.head.reportingGroupId),
        },
        { itemId: item.id },
        "fix me",
      );

      const model = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      await sectionsRepo.saveSection(model, model.version);

      const recreated = expectDefined(
        await prisma.item.findFirst({
          where: { reportSectionId: testData.section.id, stableId: STABLE_A },
        }),
      );
      // New PK, same lineage.
      expect(recreated.id).not.toBe(item.id);

      const comments = await commentsForSection();
      expect(comments).toHaveLength(1);
      expect(expectDefined(comments[0]).itemId).toBe(recreated.id);
      expect(expectDefined(comments[0]).text).toBe("fix me");
    });

    it("hard-deletes a comment when its record is dropped from the payload", async () => {
      const item = await seedItem();
      await repo.insertComment(
        {
          userId: testData.head.id,
          role: "head",
          reportingGroupId: expectDefined(testData.head.reportingGroupId),
        },
        { itemId: item.id },
        "fix me",
      );

      const model = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      // Remove the item from the payload → its comment must not survive.
      await sectionsRepo.saveSection({ ...model, items: [] }, model.version);

      expect(await commentsForSection()).toHaveLength(0);
    });

    it("preserves or rejects a comment racing the same record's save", async () => {
      const item = await seedItem();
      const model = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );

      const [saveResult, commentResult] = await Promise.allSettled([
        sectionsRepo.saveSection(model, model.version),
        repo.insertComment(
          {
            userId: testData.head.id,
            role: "head",
            reportingGroupId: expectDefined(testData.head.reportingGroupId),
          },
          { itemId: item.id },
          "racing comment",
        ),
      ]);

      expect(saveResult.status).toBe("fulfilled");
      if (commentResult.status === "rejected") {
        expect(commentResult.reason as unknown).toBeInstanceOf(
          ReviewNotFoundError,
        );
        return;
      }

      const recreated = expectDefined(
        await prisma.item.findUnique({
          where: {
            reportSectionId_stableId: {
              reportSectionId: testData.section.id,
              stableId: STABLE_A,
            },
          },
        }),
      );
      const comments = await commentsForSection();
      expect(comments).toHaveLength(1);
      expect(expectDefined(comments[0])).toMatchObject({
        itemId: recreated.id,
        text: "racing comment",
      });
    });

    it("returns ReviewNotFoundError for a PK deleted by a completed save", async () => {
      const item = await seedItem();
      const model = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      await sectionsRepo.saveSection({ ...model, items: [] }, model.version);

      await expect(
        repo.insertComment(
          {
            userId: testData.head.id,
            role: "head",
            reportingGroupId: expectDefined(testData.head.reportingGroupId),
          },
          { itemId: item.id },
          "stale comment",
        ),
      ).rejects.toBeInstanceOf(ReviewNotFoundError);
    });
  });

  describe("verdict + auto-un-submit", () => {
    it("changes_requested returns a submitted section to draft (exactly once)", async () => {
      await setSubmitted();
      const result = await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        expectedVersion: 1,
      });
      expect(result.unsubmitted).toBe(true);

      const after = expectDefined(
        await prisma.reportSection.findUnique({
          where: { id: testData.section.id },
        }),
      );
      expect(after.status).toBe("draft");
      expect(after.submittedAt).toBeNull();
      expect(after.revokedBy).toBe(testData.head.id);
    });

    it("approved leaves the section submitted", async () => {
      await setSubmitted();
      const result = await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "approved",
        expectedVersion: 1,
      });
      expect(result.unsubmitted).toBe(false);
      const after = expectDefined(
        await prisma.reportSection.findUnique({
          where: { id: testData.section.id },
        }),
      );
      expect(after.status).toBe("submitted");
    });

    it("changes_requested on an already-draft section records the verdict but un-submits nothing", async () => {
      const result = await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        expectedVersion: 1,
      });
      expect(result.unsubmitted).toBe(false);
      const review = await prisma.sectionReview.findFirst({
        where: { reportSectionId: testData.section.id },
      });
      expect(expectDefined(review).verdict).toBe("changes_requested");
    });
  });

  describe("verdict comment", () => {
    it("stores the reason with the verdict, exposes it to the Lead, and clears it on approval", async () => {
      await setSubmitted();
      await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        comment: "Add the missing risk owner.",
        expectedVersion: 1,
      });
      const returned = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(expectDefined(returned.reviews[0]).comment).toBe(
        "Add the missing risk owner.",
      );

      await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "approved",
        expectedVersion: 1,
      });
      const approved = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(expectDefined(approved.reviews[0]).comment).toBeUndefined();
    });
  });

  describe("review write lifecycle gate", () => {
    it.each([
      [
        "scheduled",
        { status: "draft", periodState: "scheduled", periodStatus: "open" },
      ],
      [
        "published tuple",
        {
          status: "published",
          periodState: "published",
          periodStatus: "published",
        },
      ],
    ] as const)(
      "rejects acknowledgement, comment, and deletion for %s reports",
      async (_label, lifecycle) => {
        const item = await seedItem();
        const comment = await repo.insertComment(
          {
            userId: testData.head.id,
            role: "head",
            reportingGroupId: expectDefined(testData.head.reportingGroupId),
          },
          { itemId: item.id },
          "protected comment",
        );
        const publishedAt = new Date("2026-07-22T12:00:00.000Z");
        await prisma.report.update({
          where: { id: testData.report.id },
          data:
            lifecycle.status === "published"
              ? {
                  ...lifecycle,
                  publishedAt,
                  publishedSnapshot: publishedSnapshotFixture({
                    reportId: testData.report.id,
                    periodStart: testData.report.periodStart,
                    periodEnd: testData.report.periodEnd,
                    publishedAt,
                    publishedById: testData.head.id,
                  }),
                }
              : lifecycle,
        });

        const actor = {
          userId: testData.head.id,
          role: "head" as const,
          reportingGroupId: expectDefined(testData.head.reportingGroupId),
        };
        await expect(
          repo.acknowledge(actor, testData.report.id, TEST_IDS.group),
        ).rejects.toBeInstanceOf(ReviewConstraintError);
        await expect(
          repo.insertComment(actor, { itemId: item.id }, "must not write"),
        ).rejects.toBeInstanceOf(ReviewConstraintError);
        await expect(
          repo.deleteComment(comment.id, actor),
        ).rejects.toBeInstanceOf(ReviewConstraintError);

        await expect(
          prisma.recordComment.findUnique({ where: { id: comment.id } }),
        ).resolves.not.toBeNull();
        await expect(
          prisma.reviewAcknowledgement.findUnique({
            where: {
              userId_reportId_groupId: {
                userId: testData.head.id,
                reportId: testData.report.id,
                groupId: TEST_IDS.group,
              },
            },
          }),
        ).resolves.toBeNull();
      },
    );
  });

  describe("transactional entitlement rechecks", () => {
    it("rejects an acknowledgement when the actor is demoted after admission", async () => {
      const actor = {
        userId: testData.head.id,
        role: "head" as const,
        reportingGroupId: expectDefined(testData.head.reportingGroupId),
      };
      const gate = createPauseGate();
      const pausedRepo = new ReviewActionsPrismaRepository(
        pauseBeforeTransaction(prisma, gate.pause) as never,
      );
      const pending = pausedRepo.acknowledge(
        actor,
        testData.report.id,
        TEST_IDS.group,
      );
      await gate.paused;
      await prisma.user.update({
        where: { id: testData.head.id },
        data: { role: "lead" },
      });
      gate.release();
      await expect(pending).rejects.toBeInstanceOf(ReviewAccessError);
      await expect(
        prisma.reviewAcknowledgement.count({
          where: { reportId: testData.report.id, userId: testData.head.id },
        }),
      ).resolves.toBe(0);
    });

    it("rejects a verdict when the actor changes group after admission", async () => {
      const groupB = await prisma.reportingGroup.create({
        data: { name: "Review group B", description: "test" },
      });
      const actor = {
        userId: testData.head.id,
        role: "head" as const,
        reportingGroupId: expectDefined(testData.head.reportingGroupId),
      };
      await setSubmitted();
      const gate = createPauseGate();
      const pausedRepo = new ReviewActionsPrismaRepository(
        pauseBeforeTransaction(prisma, gate.pause) as never,
      );
      const pending = pausedRepo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: actor.userId,
        verdict: "approved",
        expectedVersion: testData.section.version,
      });
      await gate.paused;
      await prisma.user.update({
        where: { id: testData.head.id },
        data: { reportingGroupId: groupB.id },
      });
      gate.release();
      await expect(pending).rejects.toBeInstanceOf(ReviewAccessError);
      await expect(sectionReviewCount()).resolves.toBe(0);
    });

    it("rejects a comment when its section author moves groups after admission", async () => {
      const item = await seedItem();
      const groupB = await prisma.reportingGroup.create({
        data: { name: "Author group B", description: "test" },
      });
      const actor = {
        userId: testData.head.id,
        role: "head" as const,
        reportingGroupId: expectDefined(testData.head.reportingGroupId),
      };
      const gate = createPauseGate();
      const pausedRepo = new ReviewActionsPrismaRepository(
        pauseBeforeTransaction(prisma, gate.pause) as never,
      );
      const pending = pausedRepo.insertComment(
        actor,
        { itemId: item.id },
        "must not write",
      );
      await gate.paused;
      await prisma.user.update({
        where: { id: testData.lead.id },
        data: { reportingGroupId: groupB.id },
      });
      gate.release();
      await expect(pending).rejects.toBeInstanceOf(ReviewAccessError);
      await expect(
        prisma.recordComment.count({ where: { itemId: item.id } }),
      ).resolves.toBe(0);
    });
  });

  async function bumpVersion(next: number) {
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { version: next },
    });
  }

  async function sectionReviewCount(): Promise<number> {
    return prisma.sectionReview.count({
      where: { reportSectionId: testData.section.id },
    });
  }

  describe("verdict version lock", () => {
    it("rejects an approved verdict whose judged version is stale and writes no row", async () => {
      await setSubmitted();
      // A lead re-submit bumped the section 1 → 2 after the reviewer opened it.
      await bumpVersion(2);

      await expect(
        repo.postVerdict({
          sectionId: testData.section.id,
          reviewerId: testData.head.id,
          verdict: "approved",
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ name: "ReviewVersionConflictError" });

      expect(await sectionReviewCount()).toBe(0);
    });

    it("rejects a changes_requested verdict on a re-submitted section and leaves it submitted", async () => {
      await setSubmitted();
      await bumpVersion(2);

      await expect(
        repo.postVerdict({
          sectionId: testData.section.id,
          reviewerId: testData.head.id,
          verdict: "changes_requested",
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ name: "ReviewVersionConflictError" });

      expect(await sectionReviewCount()).toBe(0);
      const after = expectDefined(
        await prisma.reportSection.findUnique({
          where: { id: testData.section.id },
        }),
      );
      expect(after.status).toBe("submitted");
      expect(after.submittedAt).not.toBeNull();
    });

    it("records a verdict on the current version with judgedVersion === input.version", async () => {
      await setSubmitted();
      const result = await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "approved",
        expectedVersion: 1,
      });
      expect(result.unsubmitted).toBe(false);

      const review = expectDefined(
        await prisma.sectionReview.findFirst({
          where: { reportSectionId: testData.section.id },
        }),
      );
      expect(review.judgedVersion).toBe(1);
    });
  });

  describe("verdict staleness (read model)", () => {
    it("reads current on the judged version and stale after a re-save bumps version", async () => {
      await setSubmitted();
      await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        expectedVersion: 1,
      });

      const returned = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(returned.version).toBe(1);
      expect(expectDefined(returned.reviews[0]).isCurrent).toBe(true);

      // A save bumps the version → the prior verdict auto-stales.
      await sectionsRepo.saveSection(returned, returned.version);
      const afterEdit = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(afterEdit.version).toBe(2);
      expect(expectDefined(afterEdit.reviews[0]).isCurrent).toBe(false);
    });
  });

  describe("concurrency — transition exactly once", () => {
    it("two concurrent changes_requested un-submit the section exactly once", async () => {
      await setSubmitted();
      const post = (reviewerId: string) =>
        repo.postVerdict({
          sectionId: testData.section.id,
          reviewerId,
          verdict: "changes_requested",
          expectedVersion: 1,
        });
      // head + admin are two distinct reviewers → two SectionReview rows.
      const [a, b] = await Promise.all([
        post(testData.head.id),
        post(admin.id),
      ]);
      const transitions = [a, b].filter((r) => r.unsubmitted).length;
      expect(transitions).toBe(1);

      const after = expectDefined(
        await prisma.reportSection.findUnique({
          where: { id: testData.section.id },
        }),
      );
      expect(after.status).toBe("draft");
    });

    it("a verdict racing the head's revoke transitions exactly once", async () => {
      await setSubmitted();
      const [verdict, revokeCount] = await Promise.all([
        repo.postVerdict({
          sectionId: testData.section.id,
          reviewerId: testData.head.id,
          verdict: "changes_requested",
          expectedVersion: 1,
        }),
        applyRevokeTransition(prisma, testData.section.id, admin.id),
      ]);
      const transitions = (verdict.unsubmitted ? 1 : 0) + revokeCount;
      expect(transitions).toBe(1);
      const after = expectDefined(
        await prisma.reportSection.findUnique({
          where: { id: testData.section.id },
        }),
      );
      expect(after.status).toBe("draft");
    });
  });

  describe("reviewer designation (end-to-end)", () => {
    it("a canReview viewer may comment on their group; a group-B record is forbidden", async () => {
      const item = await seedItem();
      const viewer = await prisma.user.create({
        data: {
          email: "rev@test.local",
          name: "Reviewer",
          lastName: "Rev",
          firstName: "V",
          role: "viewer",
          samlId: "rev-test",
        },
      });
      await prisma.viewerGroupAccess.create({
        data: {
          viewerUserId: viewer.id,
          groupId: TEST_IDS.group,
          canReview: true,
        },
      });
      const viewerSession: UserSession = {
        userId: viewer.id,
        email: "rev@test.local",
        name: "Reviewer",
        role: "viewer",
        viewerGroupAccess: [TEST_IDS.group],
      };

      await expect(
        service.comment(viewerSession, { itemId: item.id, text: "please fix" }),
      ).resolves.toMatchObject({ text: "please fix" });

      // A group-B section + item: the group-A reviewer is not designated there.
      const groupB = await prisma.reportingGroup.create({
        data: { name: "Group B", description: "second" },
      });
      const leadB = await prisma.user.create({
        data: {
          email: "leadb@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "leadb-test",
          reportingGroupId: groupB.id,
        },
      });
      const sectionB = await prisma.reportSection.create({
        data: { reportId: testData.report.id, authorId: leadB.id },
      });
      const projectB = await prisma.project.create({
        data: { name: "Project B", leadId: leadB.id },
      });
      const itemB = await prisma.item.create({
        data: {
          reportSectionId: sectionB.id,
          projectId: projectB.id,
          type: "current",
          text: "b",
          tag: "t",
          workflowStatus: "in_progress",
          stageNames: ["dev"],
        },
      });

      await expect(
        service.comment(viewerSession, { itemId: itemB.id, text: "no" }),
      ).rejects.toMatchObject({ name: "ReviewAccessError" });
    });
  });

  describe("carry-over does not copy comments", () => {
    it("a carried record's comment stays with the source period", async () => {
      const sourceItem = await prisma.item.create({
        data: {
          reportSectionId: testData.section.id,
          stableId: STABLE_A,
          projectId: testData.project.id,
          type: "next",
          text: "Carry me",
          tag: "feature",
          workflowStatus: "planned",
          stageNames: ["dev"],
        },
      });
      await repo.insertComment(
        {
          userId: testData.head.id,
          role: "head",
          reportingGroupId: expectDefined(testData.head.reportingGroupId),
        },
        { itemId: sourceItem.id },
        "source comment",
      );

      const targetReport = await prisma.report.create({
        data: {
          periodStart: new Date("2026-04-14"),
          periodEnd: new Date("2026-04-20"),
          deadline: new Date("2026-04-18"),
        },
      });
      const targetSection = await prisma.reportSection.create({
        data: { reportId: targetReport.id, authorId: testData.lead.id },
      });
      const assignedStage = await prisma.stage.create({
        data: { name: "dev", sortOrder: 1 },
      });
      await prisma.stageAssignment.create({
        data: {
          userId: testData.lead.id,
          projectId: testData.project.id,
          stageId: assignedStage.id,
        },
      });
      await prisma.projectStatus.create({
        data: {
          reportSectionId: targetSection.id,
          projectId: testData.project.id,
          status: null,
        },
      });

      const carryService = new CarryOverService(
        new CarryOverPrismaRepository(prisma as unknown as PrismaService),
      );
      await carryService.executeCarryOver(testData.report.id, targetReport.id);

      const carried = await prisma.item.findMany({
        where: { reportSectionId: targetSection.id },
      });
      expect(carried.length).toBeGreaterThan(0);
      const targetComments = await prisma.recordComment.count({
        where: { item: { reportSectionId: targetSection.id } },
      });
      expect(targetComments).toBe(0);

      const sourceComments = await prisma.recordComment.count({
        where: { item: { reportSectionId: testData.section.id } },
      });
      expect(sourceComments).toBe(1);
    });
  });
});
