import type { UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper";
import { CarryOverPrismaRepository } from "../../carry-over/carry-over.prisma-repository.js";
import { CarryOverService } from "../../carry-over/carry-over.service.js";
import { applyRevokeTransition } from "../../report-sections/domain/revoke-transition.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/infrastructure/report-sections.prisma-repository.js";
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
    repo = new ReviewActionsPrismaRepository(prisma as never);
    sectionsRepo = new ReportSectionsPrismaRepository(prisma as never);
    service = new ReviewActionsService(repo);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
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
    await cleanDatabase(prisma);
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
      await repo.insertComment(testData.head.id, { itemId: item.id }, "fix me");

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
      await repo.insertComment(testData.head.id, { itemId: item.id }, "fix me");

      const model = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      // Remove the item from the payload → its comment must not survive.
      await sectionsRepo.saveSection({ ...model, items: [] }, model.version);

      expect(await commentsForSection()).toHaveLength(0);
    });
  });

  describe("verdict + auto-un-submit", () => {
    it("changes_requested returns a submitted section to draft (exactly once)", async () => {
      await setSubmitted();
      const result = await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        judgedVersion: 1,
        expectedVersion: 1,
        currentStatus: "submitted",
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
        judgedVersion: 1,
        expectedVersion: 1,
        currentStatus: "submitted",
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
        judgedVersion: 1,
        expectedVersion: 1,
        currentStatus: "draft",
      });
      expect(result.unsubmitted).toBe(false);
      const review = await prisma.sectionReview.findFirst({
        where: { reportSectionId: testData.section.id },
      });
      expect(expectDefined(review).verdict).toBe("changes_requested");
    });
  });

  describe("verdict staleness (read model)", () => {
    it("reads current on the judged version and stale after a re-save bumps version", async () => {
      await setSubmitted();
      await repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        judgedVersion: 1,
        expectedVersion: 1,
        currentStatus: "submitted",
      });

      const returned = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(returned.version).toBe(1);
      expect(expectDefined(returned.reviews?.[0]).isCurrent).toBe(true);

      // A save bumps the version → the prior verdict auto-stales.
      await sectionsRepo.saveSection(returned, returned.version);
      const afterEdit = expectDefined(
        await sectionsRepo.getSectionById(testData.section.id),
      );
      expect(afterEdit.version).toBe(2);
      expect(expectDefined(afterEdit.reviews?.[0]).isCurrent).toBe(false);
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
          judgedVersion: 1,
          expectedVersion: 1,
          currentStatus: "submitted",
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
          judgedVersion: 1,
          expectedVersion: 1,
          currentStatus: "submitted",
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
      // Source 'next' item with a comment.
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
        testData.head.id,
        { itemId: sourceItem.id },
        "source comment",
      );

      // Editable target period + matched target section (same author).
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

      const carryService = new CarryOverService(
        new CarryOverPrismaRepository(prisma as never),
      );
      await carryService.executeCarryOver(testData.report.id, targetReport.id);

      // The item carried into the target section, but the comment did NOT.
      const carried = await prisma.item.findMany({
        where: { reportSectionId: targetSection.id },
      });
      expect(carried.length).toBeGreaterThan(0);
      const targetComments = await prisma.recordComment.count({
        where: { item: { reportSectionId: targetSection.id } },
      });
      expect(targetComments).toBe(0);

      // The source comment is untouched.
      const sourceComments = await prisma.recordComment.count({
        where: { item: { reportSectionId: testData.section.id } },
      });
      expect(sourceComments).toBe(1);
    });
  });
});
