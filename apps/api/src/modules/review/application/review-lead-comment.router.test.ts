import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { leadProcedure } from "../../../infrastructure/trpc/trpc.middleware.js";
import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createAuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { ReviewNotFoundError } from "./review.service.js";
import {
  type ReviewActionsRepository,
  ReviewActionsService,
} from "./review-actions.service.js";

const ID = "00000000-0000-4000-8000-000000000001";
const TEXT = "Private reply not for audit";
const comment = {
  id: ID,
  reviewerId: ID,
  reviewerName: "Lead",
  text: TEXT,
  createdAt: new Date("2026-01-01"),
};

function fixture(role: UserSession["role"] | null = "lead") {
  const insertLeadItemComment = vi.fn().mockResolvedValue(comment);
  const unused = vi.fn(() => {
    throw new Error("reviewer path reached");
  });
  const repo: ReviewActionsRepository = {
    insertLeadItemComment,
    acknowledge: unused,
    listAcknowledgements: unused,
    getRecordAnchorGroup: unused,
    getViewerCanReview: unused,
    insertComment: unused,
    getCommentContext: unused,
    deleteComment: unused,
    getVerdictContext: unused,
    postVerdict: unused,
  };
  const service = new ReviewActionsService(repo);
  const logger = createNullLogger();
  const logs = vi.fn();
  logger.info = logs;
  logger.debug = logs;
  logger.warn = logs;
  logger.error = logs;
  const persist = vi.fn().mockResolvedValue({});
  const app = createAppRouter(
    createStubAppRouterDeps({ reviewActionsService: service }),
  );
  const session =
    role === null
      ? null
      : { userId: ID, role, email: "lead@test.local", name: "Lead" };
  const caller = app.createCaller({
    session,
    logger,
    auditLogger: createAuditLogger(logger),
    prisma: { userActionLog: { create: persist } } as unknown as PrismaService,
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
  return {
    caller,
    app,
    service,
    insertLeadItemComment,
    logs,
    persist,
    unused,
    session,
  };
}

describe("review.leadItemComment", () => {
  it("uses the reference-identical canonical Lead chain and returns the persisted session-authored reply", async () => {
    const f = fixture();
    const base = (
      leadProcedure._def as unknown as { middlewares: readonly unknown[] }
    ).middlewares;
    const procedures = f.app._def.procedures as unknown as Record<
      string,
      { _def: { middlewares: readonly unknown[] } }
    >;
    const chain = procedures["review.leadItemComment"]?._def.middlewares;
    expect(chain?.slice(0, base.length)).toEqual(base);
    await expect(
      f.caller.review.leadItemComment({ itemId: ID, text: TEXT }),
    ).resolves.toEqual(comment);
    expect(f.insertLeadItemComment).toHaveBeenCalledWith(f.session, ID, TEXT);
    expect(f.unused).not.toHaveBeenCalled();
    expect(f.persist.mock.calls).toMatchObject([
      [
        {
          data: {
            procedure: "review.leadItemComment",
            targetId: ID,
            userId: ID,
            status: "success",
          },
        },
      ],
    ]);
    expect(
      JSON.stringify([f.logs.mock.calls, f.persist.mock.calls]),
    ).not.toContain(TEXT);
  });

  it.each(["head", "admin", "viewer", null] as const)(
    "rejects %s before any write",
    async (role) => {
      const f = fixture(role);
      await expect(
        f.caller.review.leadItemComment({ itemId: ID, text: TEXT }),
      ).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(f.insertLeadItemComment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { itemId: "invalid", text: TEXT },
    { itemId: ID, text: "\u0000" },
    { itemId: ID, text: "\u200B" },
    { itemId: ID, text: "  " },
    { itemId: ID, text: "x".repeat(2001) },
    ...[
      "authorId",
      "reviewerId",
      "riskId",
      "decisionId",
      "reportId",
      "groupId",
      "parentId",
    ].map((key) => ({ itemId: ID, text: TEXT, [key]: ID })),
  ])(
    "rejects malformed/forged input %# without logging text",
    async (input) => {
      const f = fixture();
      await expect(
        f.caller.review.leadItemComment(input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(f.insertLeadItemComment).not.toHaveBeenCalled();
      expect(
        JSON.stringify([f.logs.mock.calls, f.persist.mock.calls]),
      ).not.toContain(TEXT);
    },
  );

  it("maps generic denial and redacts failure audit/logs", async () => {
    const f = fixture();
    f.insertLeadItemComment.mockRejectedValue(
      new ReviewNotFoundError("Record not found."),
    );
    await expect(
      f.caller.review.leadItemComment({ itemId: ID, text: TEXT }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Record not found.",
    });
    expect(f.persist.mock.calls).toMatchObject([
      [{ data: { targetId: ID, status: "fail", reason: "NOT_FOUND" } }],
    ]);
    expect(
      JSON.stringify([f.logs.mock.calls, f.persist.mock.calls]),
    ).not.toContain(TEXT);
  });

  it("does not log database error text", async () => {
    const f = fixture();
    f.insertLeadItemComment.mockRejectedValue(new Error(TEXT));
    await expect(
      f.caller.review.leadItemComment({ itemId: ID, text: TEXT }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(
      JSON.stringify([f.logs.mock.calls, f.persist.mock.calls]),
    ).not.toContain(TEXT);
  });

  it("defensively rejects non-Lead direct service calls", async () => {
    const f = fixture();
    await expect(
      f.service.commentOwnItem(
        { userId: ID, role: "admin" },
        { itemId: ID, text: TEXT },
      ),
    ).rejects.toMatchObject({
      name: "ReviewNotFoundError",
      message: "Record not found.",
    });
    expect(f.insertLeadItemComment).not.toHaveBeenCalled();
  });
});
