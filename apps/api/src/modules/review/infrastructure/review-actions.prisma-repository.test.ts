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
const GROUP_ID = "99999999-9999-4999-8999-999999999999";

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
        isActive: true,
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

interface AcknowledgementSetup {
  readonly currentUser?: {
    readonly isActive: boolean;
    readonly role: string;
    readonly reportingGroupId: string | null;
    readonly viewerGroupAccess: readonly {
      readonly groupId: string;
      readonly canReview: boolean;
    }[];
  };
  readonly currentSection?: {
    readonly id: string;
    readonly authorId: string;
  } | null;
  readonly reportRow?: typeof editableReportRow;
}

function buildAcknowledgementRepository({
  currentUser = {
    isActive: true,
    role: "viewer",
    reportingGroupId: null,
    viewerGroupAccess: [{ groupId: GROUP_ID, canReview: false }],
  },
  currentSection = { id: SECTION_ID, authorId: AUTHOR_ID },
  reportRow = editableReportRow,
}: AcknowledgementSetup = {}) {
  const findFirst = vi
    .fn()
    .mockResolvedValueOnce({ id: SECTION_ID, authorId: AUTHOR_ID })
    .mockResolvedValueOnce(currentSection);
  const seenAt = new Date("2026-09-06T12:00:00.000Z");
  const upsert = vi.fn().mockResolvedValue({
    userId: REVIEWER_ID,
    reportId: REPORT_ID,
    groupId: GROUP_ID,
    seenAt,
  });
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([reportRow]),
    reportSection: { findFirst },
    user: { findUnique: vi.fn().mockResolvedValue(currentUser) },
    reviewAcknowledgement: { upsert },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    repo: new ReviewActionsPrismaRepository(prisma as never),
    tx,
    upsert,
    seenAt,
  };
}

describe("ReviewActionsPrismaRepository.acknowledge", () => {
  it("allows a current viewer access-holder without reviewer designation", async () => {
    const { repo, tx, upsert, seenAt } = buildAcknowledgementRepository();

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).resolves.toEqual({
      userId: REVIEWER_ID,
      reportId: REPORT_ID,
      groupId: GROUP_ID,
      seenAt,
    });
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: REVIEWER_ID },
      select: {
        isActive: true,
        role: true,
        reportingGroupId: true,
        viewerGroupAccess: {
          where: { groupId: GROUP_ID },
          select: { groupId: true },
        },
      },
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("rejects a viewer whose current group access was removed without writing", async () => {
    const { repo, upsert } = buildAcknowledgementRepository({
      currentUser: {
        isActive: true,
        role: "viewer",
        reportingGroupId: null,
        viewerGroupAccess: [],
      },
    });

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).rejects.toThrow("no longer have access");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an actor deactivated after admission without writing", async () => {
    const { repo, upsert } = buildAcknowledgementRepository({
      currentUser: {
        isActive: false,
        role: "viewer",
        reportingGroupId: null,
        viewerGroupAccess: [{ groupId: GROUP_ID, canReview: false }],
      },
    });

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).rejects.toThrow("no longer have access");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not write when the representative section disappears after locking", async () => {
    const { repo, upsert } = buildAcknowledgementRepository({
      currentSection: null,
    });

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not write when the representative section changes after locking", async () => {
    const { repo, upsert } = buildAcknowledgementRepository({
      currentSection: {
        id: CURRENT_ITEM_ID,
        authorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not write after the report lifecycle becomes non-editable", async () => {
    const { repo, upsert } = buildAcknowledgementRepository({
      reportRow: {
        ...editableReportRow,
        status: "published",
        periodState: "closed",
        periodStatus: "published",
      },
    });

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "viewer" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).rejects.toThrow("not editable");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rechecks the same deterministic section when a group has multiple authors", async () => {
    const firstAuthorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const otherAuthorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const seenAt = new Date("2026-09-06T12:00:00.000Z");
    const findFirst = vi.fn((args: { orderBy?: { id?: string } }) =>
      Promise.resolve(
        args.orderBy?.id === "asc"
          ? { id: SECTION_ID, authorId: firstAuthorId }
          : { id: CURRENT_ITEM_ID, authorId: otherAuthorId },
      ),
    );
    const upsert = vi.fn().mockResolvedValue({
      userId: REVIEWER_ID,
      reportId: REPORT_ID,
      groupId: GROUP_ID,
      seenAt,
    });
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
      reportSection: { findFirst },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          isActive: true,
          role: "admin",
          reportingGroupId: null,
          viewerGroupAccess: [],
        }),
      },
      reviewAcknowledgement: { upsert },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new ReviewActionsPrismaRepository(prisma as never);

    await expect(
      repo.acknowledge(
        { userId: REVIEWER_ID, role: "admin" },
        REPORT_ID,
        GROUP_ID,
      ),
    ).resolves.toEqual({
      userId: REVIEWER_ID,
      reportId: REPORT_ID,
      groupId: GROUP_ID,
      seenAt,
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      orderBy: { id: "asc" },
    });
    expect(findFirst.mock.calls[1]?.[0]).toMatchObject({
      orderBy: { id: "asc" },
    });
    expect(upsert).toHaveBeenCalledOnce();
  });
});

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
