import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { ProductFeedbackPrismaRepository } from "./product-feedback.prisma-repository";
import {
  feedbackAccessFromSession,
  type FeedbackCreateInput,
} from "./product-feedback.repository";

const P2002 = {
  code: "P2002",
  message: "Unique constraint failed",
  meta: {
    driverAdapterError: {
      cause: {
        originalMessage: "duplicate key value for clientId",
      },
    },
  },
};

function access(userId: string, role: UserSession["role"] = "lead") {
  const session: UserSession = {
    userId,
    role,
    name: `Lead ${userId}`,
    email: `${userId}@example.test`,
    reportingGroupId: "group-1",
  };
  return feedbackAccessFromSession(session);
}

function input(): FeedbackCreateInput {
  return {
    projectName: "weekly-report",
    type: "bug",
    message: "Concurrent feedback",
    status: "open",
    url: "/lead/report/report-1",
    urlPattern: null,
    viewport: "1440x900",
    userAgent: "test",
    authorName: "ignored",
    authorEmail: "ignored@example.test",
    clientId: "concurrent_client",
    annotations: [],
    screenshotDataUrl: "data:image/jpeg;base64,AA==",
    screenshotRegion: null,
    diagnostics: { console: [], network: [] },
  };
}

function winner(authorUserId: string) {
  const now = new Date("2026-09-03T10:00:00.000Z");
  return {
    id: "feedback-winner",
    projectName: "weekly-report",
    type: "bug",
    message: "Concurrent feedback",
    status: "open",
    url: "/lead/report/report-1",
    urlPattern: null,
    screenshotUrl: "data:image/jpeg;base64,AA==",
    screenshotRegion: null,
    diagnostics: { console: [], network: [] },
    viewport: "1440x900",
    userAgent: "test",
    authorUserId,
    authorName: `Lead ${authorUserId}`,
    authorEmail: `${authorUserId}@example.test`,
    authorReportingGroupId: "group-1",
    clientId: "concurrent_client",
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    annotations: [],
  };
}

function createHarness(
  readWinner: ReturnType<typeof winner>,
  createError: unknown = P2002,
) {
  const findUnique = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(readWinner);
  const create = vi.fn().mockRejectedValue(createError);
  const prisma = { productFeedback: { findUnique, create } };
  return {
    repository: new ProductFeedbackPrismaRepository(
      prisma as unknown as PrismaService,
    ),
    findUnique,
  };
}

describe("ProductFeedbackPrismaRepository concurrent create", () => {
  it("re-reads and returns the same-author winner after the clientId race", async () => {
    const { repository, findUnique } = createHarness(winner("lead-a"));

    await expect(
      repository.create(access("lead-a"), input()),
    ).resolves.toMatchObject({
      id: "feedback-winner",
      authorUserId: "lead-a",
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("does not disclose a winner owned by another author", async () => {
    const { repository } = createHarness(winner("lead-b"));

    await expect(
      repository.create(access("lead-a"), input()),
    ).rejects.toMatchObject({
      code: "STORE_DUPLICATE",
    });
  });

  it("rethrows an unrelated persistence failure unchanged", async () => {
    const failure = new Error("database unavailable");
    const { repository } = createHarness(winner("lead-a"), failure);

    await expect(repository.create(access("lead-a"), input())).rejects.toBe(
      failure,
    );
  });
});

describe("ProductFeedbackPrismaRepository bulk deletion", () => {
  it("scopes a non-admin bulk deletion to the authenticated author", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const repository = new ProductFeedbackPrismaRepository({
      productFeedback: { deleteMany },
    } as unknown as PrismaService);

    await repository.deleteAll(access("lead-a"));

    expect(deleteMany).toHaveBeenCalledWith({
      where: { projectName: "weekly-report", authorUserId: "lead-a" },
    });
  });

  it("scopes an admin bulk deletion to the whole WeeklyReport project", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const repository = new ProductFeedbackPrismaRepository({
      productFeedback: { deleteMany },
    } as unknown as PrismaService);

    await repository.deleteAll(access("admin", "admin"));

    expect(deleteMany).toHaveBeenCalledWith({
      where: { projectName: "weekly-report" },
    });
  });
});
