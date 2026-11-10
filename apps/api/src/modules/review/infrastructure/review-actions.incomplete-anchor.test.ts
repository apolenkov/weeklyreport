// An unfinished risk or decision is its author's private draft: nobody else
// may comment on it or delete a comment from it, and the refusal looks exactly
// like a record or comment that does not exist
// (openspec: record-comment-save-coordination).
import { describe, expect, it, vi } from "vitest";

import { ReviewNotFoundError } from "../application/review.service.js";
import type { ReviewWriteActor } from "../application/review-actions.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

const RAW_ID = "11111111-1111-4111-8111-111111111111";
const CURRENT_ID = "22222222-2222-4222-8222-222222222222";
const STABLE_ID = "33333333-3333-4333-8333-333333333333";
const SECTION_ID = "44444444-4444-4444-8444-444444444444";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const REVIEWER_ID = "66666666-6666-4666-8666-666666666666";
const COMMENT_ID = "77777777-7777-4777-8777-777777777777";
const AUTHOR_ID = "88888888-8888-4888-8888-888888888888";
const GROUP_ID = "99999999-9999-4999-8999-999999999999";
const HEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const RECORD_NOT_FOUND = "Record not found.";
const COMMENT_NOT_FOUND = "Comment not found.";

const ADMIN: ReviewWriteActor = { userId: REVIEWER_ID, role: "admin" };
const HEAD: ReviewWriteActor = {
  userId: HEAD_ID,
  role: "head",
  reportingGroupId: GROUP_ID,
};
const AUTHOR_HEAD: ReviewWriteActor = {
  userId: AUTHOR_ID,
  role: "head",
  reportingGroupId: GROUP_ID,
};

const editableReportRow = {
  id: REPORT_ID,
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

const lineageRow = {
  stableId: STABLE_ID,
  reportSectionId: SECTION_ID,
  reportSection: { reportId: REPORT_ID, authorId: AUTHOR_ID },
};

const targetSection = {
  reportSection: {
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    author: { reportingGroupId: GROUP_ID },
  },
};

const createdComment = {
  id: COMMENT_ID,
  reviewerId: REVIEWER_ID,
  text: "Please revise",
  createdAt: new Date("2026-07-15T10:00:00.000Z"),
  reviewer: { name: "Reviewer" },
};

type Kind = "item" | "risk" | "decision";
type Details = Record<string, string | null>;

const UNFINISHED: Record<Kind, Details> = {
  item: {},
  risk: { impact: "Slips a week", mitigation: null },
  decision: { impact: null },
};
const FINISHED: Record<Kind, Details> = {
  item: {},
  risk: { impact: "Slips a week", mitigation: "Add a tester" },
  decision: { impact: "Unblocks the release" },
};

function buildTx(actor: ReviewWriteActor) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([editableReportRow]),
    item: { findUnique: vi.fn() },
    risk: { findUnique: vi.fn() },
    decision: { findUnique: vi.fn() },
    reportSection: {
      findFirst: vi.fn().mockResolvedValue({
        authorId: AUTHOR_ID,
        author: { reportingGroupId: GROUP_ID },
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isActive: true,
        role: actor.role,
        reportingGroupId: actor.reportingGroupId ?? null,
        viewerGroupAccess: [],
      }),
    },
    recordComment: {
      create: vi.fn().mockResolvedValue(createdComment),
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

function repositoryOver(tx: ReturnType<typeof buildTx>) {
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return new ReviewActionsPrismaRepository(prisma as never);
}

function commentOn(kind: Kind, actor: ReviewWriteActor, details: Details) {
  const tx = buildTx(actor);
  tx[kind].findUnique
    .mockResolvedValueOnce(lineageRow)
    .mockResolvedValueOnce({ id: CURRENT_ID, ...details });
  const anchor = { [`${kind}Id`]: RAW_ID };
  return {
    tx,
    result: repositoryOver(tx).insertComment(actor, anchor, "Please revise"),
  };
}

function deleteFrom(kind: Kind, actor: ReviewWriteActor, details: Details) {
  const tx = buildTx(actor);
  const anchors = { item: null, risk: null, decision: null };
  tx.recordComment.findUnique
    .mockResolvedValueOnce({
      reviewerId: REVIEWER_ID,
      ...anchors,
      [kind]: targetSection,
    })
    .mockResolvedValueOnce({
      reviewerId: REVIEWER_ID,
      ...anchors,
      [kind]: { ...targetSection, ...details },
    });
  return { tx, result: repositoryOver(tx).deleteComment(COMMENT_ID, actor) };
}

describe("review comments on an unfinished risk or decision", () => {
  it.each([
    ["risk", ADMIN],
    ["risk", HEAD],
    ["decision", ADMIN],
    ["decision", HEAD],
  ] as const)(
    "refuses a new comment on an unfinished %s from someone who is not its author",
    async (kind, actor) => {
      const { tx, result } = commentOn(kind, actor, UNFINISHED[kind]);

      // Same answer as a record that does not exist.
      await expect(result).rejects.toThrow(
        new ReviewNotFoundError(RECORD_NOT_FOUND),
      );
      expect(tx.recordComment.create).not.toHaveBeenCalled();
    },
  );

  it("decides after the locks, from the record as it is stored now", async () => {
    const { tx, result } = commentOn("risk", ADMIN, UNFINISHED.risk);

    await expect(result).rejects.toThrow(RECORD_NOT_FOUND);

    const lockOrder = Math.max(...tx.$queryRaw.mock.invocationCallOrder);
    const reRead = tx.risk.findUnique.mock.invocationCallOrder[1];
    expect(reRead).toBeGreaterThan(lockOrder);
    expect(tx.risk.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        reportSectionId_stableId: {
          reportSectionId: SECTION_ID,
          stableId: STABLE_ID,
        },
      },
      select: { id: true, impact: true, mitigation: true },
    });
  });

  it("lets the author comment on their own unfinished risk", async () => {
    const { tx, result } = commentOn("risk", AUTHOR_HEAD, UNFINISHED.risk);

    await expect(result).resolves.toMatchObject({ id: COMMENT_ID });
    expect(tx.recordComment.create).toHaveBeenCalledOnce();
  });

  it.each(["risk", "decision", "item"] as const)(
    "accepts a comment on a finished %s as before",
    async (kind) => {
      const { tx, result } = commentOn(kind, ADMIN, FINISHED[kind]);

      await expect(result).resolves.toMatchObject({
        id: COMMENT_ID,
        reviewerId: REVIEWER_ID,
        createdAt: createdComment.createdAt,
      });
      expect(tx.recordComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            [`${kind}Id`]: CURRENT_ID,
          }) as unknown,
        }),
      );
    },
  );
});

describe("deleting a review comment from an unfinished risk or decision", () => {
  it.each([
    ["risk", "its own writer", ADMIN],
    ["risk", "a head of the group", HEAD],
    ["decision", "its own writer", ADMIN],
    ["decision", "a head of the group", HEAD],
  ] as const)(
    "keeps the comment on an unfinished %s when %s asks to delete it",
    async (kind, _who, actor) => {
      const { tx, result } = deleteFrom(kind, actor, UNFINISHED[kind]);

      // Same answer as a comment that does not exist.
      await expect(result).rejects.toThrow(
        new ReviewNotFoundError(COMMENT_NOT_FOUND),
      );
      expect(tx.recordComment.delete).not.toHaveBeenCalled();
    },
  );

  it("keeps it from a reviewer who wrote it and is no admin", async () => {
    const reviewer: ReviewWriteActor = { userId: REVIEWER_ID, role: "viewer" };
    const { tx, result } = deleteFrom("risk", reviewer, UNFINISHED.risk);

    await expect(result).rejects.toThrow(COMMENT_NOT_FOUND);
    expect(tx.recordComment.delete).not.toHaveBeenCalled();
    // Refused before any entitlement lookup: nothing about the draft leaks.
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets the author delete a comment from their own unfinished risk", async () => {
    const { tx, result } = deleteFrom("risk", AUTHOR_HEAD, UNFINISHED.risk);

    await expect(result).resolves.toBeUndefined();
    expect(tx.recordComment.delete).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
    });
  });

  it.each(["risk", "decision", "item"] as const)(
    "deletes from a finished %s as before, the same comment the reader named",
    async (kind) => {
      const { tx, result } = deleteFrom(kind, ADMIN, FINISHED[kind]);

      await expect(result).resolves.toBeUndefined();
      expect(tx.recordComment.delete).toHaveBeenCalledWith({
        where: { id: COMMENT_ID },
      });
    },
  );
});
