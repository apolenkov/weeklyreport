import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  type PostVerdictParams,
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
const plainViewerA = session({ role: "viewer", viewerGroupAccess: [GROUP_A] });
const leadSession = session({ role: "lead", reportingGroupId: GROUP_A });

interface RepoOverrides {
  anchorGroup?: string | null;
  verdictContext?: VerdictContext;
  canReview?: boolean;
}

function buildRepo(overrides: RepoOverrides = {}) {
  const insertComment = vi.fn((reviewerId: string, anchor: RecordAnchor) =>
    Promise.resolve({
      id: "aa000000-0000-4000-8000-0000000000aa",
      reviewerId,
      reviewerName: "R",
      text: "please fix",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      ...anchor,
    }),
  );
  const postVerdict = vi.fn((params: PostVerdictParams) =>
    Promise.resolve({
      unsubmitted:
        params.verdict === "changes_requested" &&
        params.currentStatus === "submitted",
    }),
  );
  const acknowledge = vi.fn((userId: string) =>
    Promise.resolve({
      userId,
      reportId: REPORT,
      groupId: GROUP_A,
      seenAt: new Date("2026-06-01T00:00:00.000Z"),
    }),
  );
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
      Promise.resolve({ reviewerId: "x", groupId: GROUP_A }),
    ),
    deleteComment: vi.fn(() => Promise.resolve()),
    getVerdictContext: vi.fn(() =>
      Promise.resolve<VerdictContext>(
        overrides.verdictContext ?? {
          version: 3,
          status: "submitted",
          groupId: GROUP_A,
          periodStatus: "open",
          archived: false,
        },
      ),
    ),
    postVerdict,
  };
  return { repo, insertComment, postVerdict, acknowledge };
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
    ).rejects.toMatchObject({ name: "ReviewAccessError" });
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
      service.comment(plainViewerA, commentInput),
    ).rejects.toMatchObject({ name: "ReviewAccessError" });
  });

  it("rejects a group-A reviewer on a group-B record (no cross-group)", async () => {
    // The record resolves to group B; the viewer is designated only for A.
    const { repo } = buildRepo({ anchorGroup: GROUP_B, canReview: false });
    const service = new ReviewActionsService(repo);
    await expect(
      service.comment(reviewerA, commentInput),
    ).rejects.toMatchObject({ name: "ReviewAccessError" });
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
    await expect(service.comment(headB, commentInput)).rejects.toMatchObject({
      name: "ReviewAccessError",
    });
  });

  it("rejects a lead (never a designated reviewer)", async () => {
    const { repo } = buildRepo();
    const service = new ReviewActionsService(repo);
    await expect(
      service.comment(leadSession, commentInput),
    ).rejects.toMatchObject({ name: "ReviewAccessError" });
  });
});

describe("ReviewActionsService — verdict", () => {
  it("judges the section's CURRENT version and un-submits on changes_requested", async () => {
    const { repo, postVerdict } = buildRepo();
    const service = new ReviewActionsService(repo);
    const result = await service.verdict(headA, {
      reportSectionId: SECTION,
      verdict: "changes_requested",
      version: 3,
    });
    expect(result).toMatchObject({ judgedVersion: 3, unsubmitted: true });
    expect(postVerdict).toHaveBeenCalledWith(
      expect.objectContaining({ judgedVersion: 3, expectedVersion: 3 }),
    );
  });

  it("approved records the verdict without un-submitting", async () => {
    const { repo } = buildRepo();
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
        version: 3,
        status: "submitted",
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
    ).rejects.toMatchObject({ name: "ReviewConstraintError" });
  });

  it("rejects a verdict from an undesignated caller before touching the period", async () => {
    const { repo, postVerdict } = buildRepo({ canReview: false });
    const service = new ReviewActionsService(repo);
    await expect(
      service.verdict(plainViewerA, {
        reportSectionId: SECTION,
        verdict: "approved",
        version: 3,
      }),
    ).rejects.toMatchObject({ name: "ReviewAccessError" });
    expect(postVerdict).not.toHaveBeenCalled();
  });
});
