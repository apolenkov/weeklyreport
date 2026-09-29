import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
} from "./review.service";
import {
  type RecordAnchor,
  type ReviewActionsRepository,
  ReviewActionsService,
  type VerdictContext,
} from "./review-actions.service";

const GROUP_A = "a0000000-0000-4000-8000-0000000000a1";
const GROUP_B = "b0000000-0000-4000-8000-0000000000b1";
const SECTION = "c0000000-0000-4000-8000-0000000000c1";
const ITEM = "d0000000-0000-4000-8000-0000000000d1";
const REPORT = "e0000000-0000-4000-8000-0000000000e1";

function session(overrides: Partial<UserSession>): UserSession {
  return {
    userId: "f0000000-0000-4000-8000-0000000000f1",
    email: "u@test.local",
    name: "U",
    role: "viewer",
    ...overrides,
  };
}

const adminSession = session({ role: "admin" });
const headA = session({ role: "head", reportingGroupId: GROUP_A });
const headB = session({ role: "head", reportingGroupId: GROUP_B });
const reviewerA = session({ role: "viewer", viewerGroupAccess: [GROUP_A] });
const leadSession = session({ role: "lead", reportingGroupId: GROUP_A });

interface RepoOverrides {
  anchorGroup?: string | null;
  verdictContext?: VerdictContext;
  canReview?: boolean;
  commentContext?: { reviewerId: string; groupId: string | null } | null;
}

function buildRepo(overrides: RepoOverrides = {}) {
  const insertComment = vi.fn(
    (actor: { userId: string }, anchor: RecordAnchor) =>
      Promise.resolve({
        id: "aa000000-0000-4000-8000-0000000000aa",
        reviewerId: actor.userId,
        reviewerName: "R",
        text: "please fix",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        ...anchor,
      }),
  );
  const postVerdict = vi.fn<ReviewActionsRepository["postVerdict"]>();
  const acknowledge = vi.fn((actor: { userId: string }) =>
    Promise.resolve({
      userId: actor.userId,
      reportId: REPORT,
      groupId: GROUP_A,
      seenAt: new Date("2026-06-01T00:00:00.000Z"),
    }),
  );
  const deleteComment = vi.fn((_commentId: string) => Promise.resolve());
  const repo: ReviewActionsRepository = {
    acknowledge,
    listAcknowledgements: vi.fn(() => Promise.resolve([])),
    getRecordAnchorGroup: vi.fn(() =>
      Promise.resolve(
        overrides.anchorGroup === undefined
          ? { groupId: GROUP_A }
          : { groupId: overrides.anchorGroup },
      ),
    ),
    getViewerCanReview: vi.fn(() =>
      Promise.resolve(overrides.canReview ?? false),
    ),
    insertComment,
    getCommentContext: vi.fn(() =>
      Promise.resolve(
        overrides.commentContext === undefined
          ? { reviewerId: "x", groupId: GROUP_A }
          : overrides.commentContext,
      ),
    ),
    deleteComment,
    getVerdictContext: vi.fn(() =>
      Promise.resolve<VerdictContext>(
        overrides.verdictContext ?? {
          groupId: GROUP_A,
          periodStatus: "open",
          archived: false,
        },
      ),
    ),
    postVerdict,
  };
  return { repo, insertComment, postVerdict, acknowledge, deleteComment };
}

const commentInput = { itemId: ITEM, text: "please fix" };

describe("ReviewActionsService — acknowledgement scope", () => {
  it("records an ack when the caller's scope covers the group", async () => {
    const { repo, acknowledge } = buildRepo();
    const service = new ReviewActionsService(repo);
    await service.acknowledge(reviewerA, {
      reportId: REPORT,
      groupId: GROUP_A,
    });
    expect(acknowledge).toHaveBeenCalledOnce();
  });

  it("rejects an ack for a group the caller cannot access", async () => {
    const { repo } = buildRepo();
    const service = new ReviewActionsService(repo);
    await expect(
      service.acknowledge(reviewerA, { reportId: REPORT, groupId: GROUP_B }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });

  it("admin may acknowledge any group", async () => {
    const { repo, acknowledge } = buildRepo();
    const service = new ReviewActionsService(repo);
    await service.acknowledge(adminSession, {
      reportId: REPORT,
      groupId: GROUP_B,
    });
    expect(acknowledge).toHaveBeenCalledOnce();
  });
});

describe("ReviewActionsService — reviewer designation (comment)", () => {
  it("allows a canReview viewer on their group", async () => {
    const { repo, insertComment } = buildRepo({ canReview: true });
    const service = new ReviewActionsService(repo);
    await service.comment(reviewerA, commentInput);
    expect(insertComment).toHaveBeenCalledOnce();
  });

  it("rejects a plain viewer (canReview=false) on their group", async () => {
    const { repo } = buildRepo({ canReview: false });
    const service = new ReviewActionsService(repo);
    await expect(
      service.comment(reviewerA, commentInput),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });

  it("rejects a group-A reviewer on a group-B record (no cross-group)", async () => {
    // The record resolves to group B; the viewer is designated only for A.
    const { repo } = buildRepo({ anchorGroup: GROUP_B, canReview: false });
    const service = new ReviewActionsService(repo);
    await expect(
      service.comment(reviewerA, commentInput),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });

  it("allows the head of the record's group (implicit designation)", async () => {
    const { repo, insertComment } = buildRepo();
    const service = new ReviewActionsService(repo);
    await service.comment(headA, commentInput);
    expect(insertComment).toHaveBeenCalledOnce();
  });

  it("rejects the head of a different group", async () => {
    const { repo } = buildRepo();
    const service = new ReviewActionsService(repo);
    await expect(service.comment(headB, commentInput)).rejects.toBeInstanceOf(
      ReviewAccessError,
    );
  });

  it("rejects a lead (never a designated reviewer)", async () => {
    const { repo } = buildRepo();
    const service = new ReviewActionsService(repo);
    await expect(
      service.comment(leadSession, commentInput),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });
});

describe("ReviewActionsService — verdict", () => {
  it("judges the section's CURRENT version and un-submits on changes_requested", async () => {
    const { repo, postVerdict } = buildRepo();
    postVerdict.mockResolvedValueOnce({ unsubmitted: true });
    const service = new ReviewActionsService(repo);
    const result = await service.verdict(headA, {
      reportSectionId: SECTION,
      verdict: "changes_requested",
      version: 3,
      comment: "Add the missing risk owner.",
    });
    expect(result).toMatchObject({ judgedVersion: 3, unsubmitted: true });
    expect(postVerdict).toHaveBeenCalledWith({
      sectionId: SECTION,
      reviewerId: headA.userId,
      verdict: "changes_requested",
      comment: "Add the missing risk owner.",
      expectedVersion: 3,
    });
  });

  it("approved records the verdict without un-submitting", async () => {
    const { repo, postVerdict } = buildRepo();
    postVerdict.mockResolvedValueOnce({ unsubmitted: false });
    const service = new ReviewActionsService(repo);
    const result = await service.verdict(headA, {
      reportSectionId: SECTION,
      verdict: "approved",
      version: 3,
    });
    expect(result.unsubmitted).toBe(false);
  });

  it("rejects a verdict on a non-editable (published) period", async () => {
    const { repo } = buildRepo({
      verdictContext: {
        groupId: GROUP_A,
        periodStatus: "published",
        archived: false,
      },
    });
    const service = new ReviewActionsService(repo);
    await expect(
      service.verdict(headA, {
        reportSectionId: SECTION,
        verdict: "changes_requested",
        version: 3,
      }),
    ).rejects.toBeInstanceOf(ReviewConstraintError);
  });

  it("rejects a verdict from an undesignated caller before touching the period", async () => {
    const { repo, postVerdict } = buildRepo({ canReview: false });
    const service = new ReviewActionsService(repo);
    await expect(
      service.verdict(reviewerA, {
        reportSectionId: SECTION,
        verdict: "approved",
        version: 3,
      }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
    expect(postVerdict).not.toHaveBeenCalled();
  });
});

describe("ReviewActionsService — deleteComment", () => {
  const COMMENT_ID = "bb000000-0000-4000-8000-0000000000bb";

  it("rejects when the comment does not exist", async () => {
    const { repo, deleteComment } = buildRepo({ commentContext: null });
    const service = new ReviewActionsService(repo);

    await expect(
      service.deleteComment(headA, { commentId: COMMENT_ID }),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
    expect(deleteComment).not.toHaveBeenCalled();
  });

  it("the head of the comment's group deletes a comment by another reviewer", async () => {
    const { repo, deleteComment } = buildRepo({
      commentContext: { reviewerId: "x", groupId: GROUP_A },
    });
    const service = new ReviewActionsService(repo);

    const result = await service.deleteComment(headA, {
      commentId: COMMENT_ID,
    });

    expect(result).toEqual({ success: true });
    expect(deleteComment).toHaveBeenCalledWith(COMMENT_ID, headA);
  });

  it("admin deletes a comment in any group", async () => {
    const { repo, deleteComment } = buildRepo({
      commentContext: { reviewerId: "x", groupId: GROUP_B },
    });
    const service = new ReviewActionsService(repo);

    const result = await service.deleteComment(adminSession, {
      commentId: COMMENT_ID,
    });

    expect(result).toEqual({ success: true });
    expect(deleteComment).toHaveBeenCalledWith(COMMENT_ID, adminSession);
  });

  it("a designated reviewer deletes their OWN comment", async () => {
    const { repo, deleteComment } = buildRepo({
      commentContext: { reviewerId: reviewerA.userId, groupId: GROUP_A },
      canReview: true,
    });
    const service = new ReviewActionsService(repo);

    const result = await service.deleteComment(reviewerA, {
      commentId: COMMENT_ID,
    });

    expect(result).toEqual({ success: true });
    expect(deleteComment).toHaveBeenCalledWith(COMMENT_ID, reviewerA);
  });

  it("a designated reviewer cannot delete ANOTHER reviewer's comment", async () => {
    // The same group, the same designation — but a different author: deleting
    // must require authorship, not just reviewer designation for the group.
    const { repo, deleteComment } = buildRepo({
      commentContext: { reviewerId: "other-reviewer", groupId: GROUP_A },
      canReview: true,
    });
    const service = new ReviewActionsService(repo);

    await expect(
      service.deleteComment(reviewerA, { commentId: COMMENT_ID }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
    expect(deleteComment).not.toHaveBeenCalled();
  });

  it("rejects a group-A reviewer deleting a group-B comment (no cross-group)", async () => {
    const { repo, deleteComment } = buildRepo({
      commentContext: { reviewerId: "x", groupId: GROUP_B },
      canReview: false,
    });
    const service = new ReviewActionsService(repo);

    await expect(
      service.deleteComment(reviewerA, { commentId: COMMENT_ID }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
    expect(deleteComment).not.toHaveBeenCalled();
  });
});
