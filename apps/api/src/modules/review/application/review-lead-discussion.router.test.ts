import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createAuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import {
  type ReviewActionsRepository,
  ReviewActionsService,
} from "./review-actions.service.js";

const ID = "83600000-0000-4000-8000-000000000201";
const INPUT = { reportSectionId: ID, stableId: ID };

function fixture(role: UserSession["role"]) {
  const readLeadItemDiscussion = vi
    .fn()
    .mockResolvedValue({ status: "available", comments: [] });
  const unused = vi.fn(() => {
    throw new Error("unrelated repository path reached");
  });
  const repo: ReviewActionsRepository = {
    readLeadItemDiscussion,
    insertLeadItemComment: unused,
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
  const logger = createNullLogger();
  const app = createAppRouter(
    createStubAppRouterDeps({
      reviewActionsService: new ReviewActionsService(repo),
    }),
  );
  const session = { userId: ID, role, email: "lead@test.local", name: "Lead" };
  const caller = app.createCaller({
    session,
    logger,
    auditLogger: createAuditLogger(logger),
    prisma: {} as unknown as PrismaService,
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, readLeadItemDiscussion, unused };
}

describe("review.leadItemDiscussion", () => {
  it("reads the own discussion through the Lead chain with the session actor", async () => {
    const f = fixture("lead");
    await expect(f.caller.review.leadItemDiscussion(INPUT)).resolves.toEqual({
      status: "available",
      comments: [],
    });
    expect(f.readLeadItemDiscussion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ID, role: "lead" }),
      INPUT,
    );
    expect(f.unused).not.toHaveBeenCalled();
  });

  it.each(["head", "viewer"] as const)(
    "rejects the %s role before reaching storage",
    async (role) => {
      const f = fixture(role);
      await expect(
        f.caller.review.leadItemDiscussion(INPUT),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(f.readLeadItemDiscussion).not.toHaveBeenCalled();
    },
  );

  it("rejects extra input fields", async () => {
    const f = fixture("lead");
    await expect(
      f.caller.review.leadItemDiscussion({ ...INPUT, authorId: ID } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.readLeadItemDiscussion).not.toHaveBeenCalled();
  });
});
