import { describe, expect, it, vi } from "vitest";

import { PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE } from "../../../lib/prisma-foreign-key-violation.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

const RAW_ITEM_ID = "11111111-1111-4111-8111-111111111111";
const CURRENT_ITEM_ID = "22222222-2222-4222-8222-222222222222";
const STABLE_ID = "33333333-3333-4333-8333-333333333333";
const SECTION_ID = "44444444-4444-4444-8444-444444444444";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const REVIEWER_ID = "66666666-6666-4666-8666-666666666666";
const AUTHOR_ID = "88888888-8888-4888-8888-888888888888";

const rawAnchorRow = {
  stableId: STABLE_ID,
  reportSectionId: SECTION_ID,
  reportSection: { reportId: REPORT_ID, authorId: AUTHOR_ID },
};

const createdComment = {
  id: "77777777-7777-4777-8777-777777777777",
  reviewerId: REVIEWER_ID,
  text: "Please revise",
  createdAt: new Date("2026-07-15T10:00:00.000Z"),
  reviewer: { name: "Reviewer" },
};

interface RepositorySetup {
  readonly rawRow?: typeof rawAnchorRow | null;
  readonly currentRow?: { id: string } | null;
  readonly createError?: unknown;
}

function buildRepository({
  rawRow = rawAnchorRow,
  currentRow = { id: CURRENT_ITEM_ID },
  createError,
}: RepositorySetup = {}) {
  const itemFindUnique = vi
    .fn()
    .mockResolvedValueOnce(rawRow)
    .mockResolvedValueOnce(currentRow);
  const recordCommentCreate =
    createError === undefined
      ? vi.fn().mockResolvedValue(createdComment)
      : vi.fn().mockRejectedValue(createError);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([
      {
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
      },
    ]),
    item: { findUnique: itemFindUnique },
    risk: { findUnique: vi.fn() },
    decision: { findUnique: vi.fn() },
    reportSection: {
      findFirst: vi.fn().mockResolvedValue({
        authorId: AUTHOR_ID,
        author: { reportingGroupId: "99999999-9999-4999-8999-999999999999" },
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "admin",
        reportingGroupId: null,
        viewerGroupAccess: [],
      }),
    },
    recordComment: { create: recordCommentCreate },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    repo: new ReviewActionsPrismaRepository(prisma as never),
    tx,
  };
}

describe("ReviewActionsPrismaRepository.insertComment", () => {
  it("returns ReviewNotFoundError when the raw anchor PK no longer exists", async () => {
    const { repo, tx } = buildRepository({ rawRow: null });

    await expect(
      repo.insertComment(
        { userId: REVIEWER_ID, role: "admin" },
        { itemId: RAW_ITEM_ID },
        "Please revise",
      ),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.recordComment.create).not.toHaveBeenCalled();
  });

  it("converts an anchor-FK pg-adapter P2003 insert failure to ReviewNotFoundError", async () => {
    const p2003 = {
      code: PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE,
      message: "Foreign key constraint violated",
      meta: {
        driverAdapterError: {
          cause: {
            originalMessage:
              'insert or update violates foreign key constraint "RecordComment_itemId_fkey"',
          },
        },
      },
    };
    const { repo } = buildRepository({ createError: p2003 });

    await expect(
      repo.insertComment(
        { userId: REVIEWER_ID, role: "admin" },
        { itemId: RAW_ITEM_ID },
        "Please revise",
      ),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("re-throws a P2003 on the reviewer FK — an integrity failure, not a missing record", async () => {
    const reviewerFkError = {
      code: PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE,
      message: "Foreign key constraint violated",
      meta: {
        driverAdapterError: {
          cause: {
            originalMessage:
              'insert or update violates foreign key constraint "RecordComment_reviewerId_fkey"',
          },
        },
      },
    };
    const { repo } = buildRepository({ createError: reviewerFkError });

    await expect(
      repo.insertComment(
        { userId: REVIEWER_ID, role: "admin" },
        { itemId: RAW_ITEM_ID },
        "Please revise",
      ),
    ).rejects.toBe(reviewerFkError);
  });

  it("locks the report and writes the stableId-resolved PK, not the raw PK", async () => {
    const { repo, tx } = buildRepository();

    await expect(
      repo.insertComment(
        { userId: REVIEWER_ID, role: "admin" },
        { itemId: RAW_ITEM_ID },
        "Please revise",
      ),
    ).resolves.toMatchObject({
      id: createdComment.id,
      reviewerName: createdComment.reviewer.name,
    });

    expect(tx.item.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: RAW_ITEM_ID },
      select: expect.objectContaining({
        stableId: true,
        reportSectionId: true,
      }) as unknown,
    });
    expect(tx.$queryRaw.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(tx.item.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        reportSectionId_stableId: {
          reportSectionId: SECTION_ID,
          stableId: STABLE_ID,
        },
      },
      select: { id: true },
    });
    expect(tx.recordComment.create).toHaveBeenCalledWith({
      data: {
        reviewerId: REVIEWER_ID,
        text: "Please revise",
        itemId: CURRENT_ITEM_ID,
        riskId: null,
        decisionId: null,
      },
      select: expect.anything() as unknown,
    });
  });
});
