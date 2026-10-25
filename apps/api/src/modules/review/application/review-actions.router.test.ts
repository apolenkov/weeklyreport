import type {
  ReviewAcknowledgementView,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import {
  type ReviewActionsRepository,
  ReviewActionsService,
} from "./review-actions.service.js";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

function leadSession(): UserSession {
  return {
    userId: VALID_UUID,
    email: "lead@test.local",
    name: "Lead",
    role: "lead",
    reportingGroupId: VALID_UUID,
  };
}

// A reviewActionsService that must NEVER be reached for a lead — the leadership
// chain rejects before the resolver runs. Every method throws so a leak would
// surface as the wrong error, not a silent pass.
function trapService() {
  const trap = () => {
    throw new Error("resolver reached — chain did not reject the lead");
  };
  return {
    acknowledge: vi.fn(trap),
    listAcknowledgements: vi.fn(trap),
    comment: vi.fn(trap),
    deleteComment: vi.fn(trap),
    verdict: vi.fn(trap),
  };
}

function leadCaller() {
  const deps = createStubAppRouterDeps({
    reviewActionsService: trapService(),
  });
  return createAppRouter(deps).createCaller({
    session: leadSession(),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("review.* leadership chain excludes lead", () => {
  it("lead is FORBIDDEN from review.acknowledge", async () => {
    await expect(
      leadCaller().review.acknowledge({
        reportId: VALID_UUID,
        groupId: VALID_UUID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.comment", async () => {
    await expect(
      leadCaller().review.comment({ itemId: VALID_UUID, text: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.verdict", async () => {
    await expect(
      leadCaller().review.verdict({
        reportSectionId: VALID_UUID,
        verdict: "changes_requested",
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.deleteComment", async () => {
    await expect(
      leadCaller().review.deleteComment({ commentId: VALID_UUID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

const VIEWER_ID = "10000000-0000-4000-8000-000000000001";
const PEER_ID = "20000000-0000-4000-8000-000000000002";
const REPORT_ID = "30000000-0000-4000-8000-000000000003";
const GROUP_ID = "40000000-0000-4000-8000-000000000004";
const FOREIGN_GROUP_ID = "50000000-0000-4000-8000-000000000005";
const OWN_ACK: ReviewAcknowledgementView = {
  userId: VIEWER_ID,
  userName: "Viewer Self",
  reportId: REPORT_ID,
  groupId: GROUP_ID,
  seenAt: new Date("2026-01-02T09:00:00.000Z"),
};
const PEER_ACK: ReviewAcknowledgementView = {
  userId: PEER_ID,
  userName: "Other Reviewer",
  reportId: REPORT_ID,
  groupId: GROUP_ID,
  seenAt: new Date("2026-01-03T09:00:00.000Z"),
};

function rosterCaller(
  role: UserSession["role"] | null,
  rows: ReviewAcknowledgementView[] = [PEER_ACK, OWN_ACK],
) {
  const unused = () => {
    throw new Error("unexpected write during acknowledgement read");
  };
  const listAcknowledgements = vi.fn(() => Promise.resolve(rows));
  const getViewerCanReview = vi.fn(() => Promise.resolve(false));
  const repo: ReviewActionsRepository = {
    acknowledge: unused,
    listAcknowledgements,
    getRecordAnchorGroup: unused,
    getViewerCanReview,
    insertComment: unused,
    getCommentContext: unused,
    deleteComment: unused,
    getVerdictContext: unused,
    postVerdict: unused,
  };
  const session: UserSession | null =
    role === null
      ? null
      : {
          userId: VIEWER_ID,
          email: "reader@test.local",
          name: "Reader",
          role,
          reportingGroupId: GROUP_ID,
          viewerGroupAccess: [GROUP_ID],
        };
  const caller = createAppRouter(
    createStubAppRouterDeps({
      reviewActionsService: new ReviewActionsService(repo),
    }),
  ).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, listAcknowledgements, getViewerCanReview };
}

describe("review.acknowledgements response contract", () => {
  // TASK-503.39: Root adopted own-receipt-only Viewer payloads.
  it("Viewer receives only their four-field receipt", async () => {
    const { caller, getViewerCanReview } = rosterCaller("viewer", [
      PEER_ACK,
      OWN_ACK,
    ]);
    await expect(
      caller.review.acknowledgements({
        reportId: REPORT_ID,
        groupId: GROUP_ID,
      }),
    ).resolves.toStrictEqual([
      {
        userId: VIEWER_ID,
        reportId: REPORT_ID,
        groupId: GROUP_ID,
        seenAt: new Date("2026-01-02T09:00:00.000Z"),
      },
    ]);
    // Reviewer designation is a write entitlement: reading the roster must not
    // consult it, so the Viewer response cannot widen with canReview.
    expect(getViewerCanReview).not.toHaveBeenCalled();
  });

  it("Viewer receives no peer receipts when they have not acknowledged", async () => {
    const { caller } = rosterCaller("viewer", [PEER_ACK]);
    await expect(
      caller.review.acknowledgements({
        reportId: REPORT_ID,
        groupId: GROUP_ID,
      }),
    ).resolves.toEqual([]);
  });

  it("Viewer receives their lone receipt without a name", async () => {
    const { caller } = rosterCaller("viewer", [OWN_ACK]);
    await expect(
      caller.review.acknowledgements({
        reportId: REPORT_ID,
        groupId: GROUP_ID,
      }),
    ).resolves.toStrictEqual([
      {
        userId: VIEWER_ID,
        reportId: REPORT_ID,
        groupId: GROUP_ID,
        seenAt: new Date("2026-01-02T09:00:00.000Z"),
      },
    ]);
  });

  it.each(["viewer", "head", "admin"] as const)(
    "%s receives an empty array for an empty roster",
    async (role) => {
      const { caller } = rosterCaller(role, []);
      await expect(
        caller.review.acknowledgements({
          reportId: REPORT_ID,
          groupId: GROUP_ID,
        }),
      ).resolves.toEqual([]);
    },
  );

  it.each(["head", "admin"] as const)(
    "%s retains names and peer receipts in their entitled group",
    async (role) => {
      const { caller } = rosterCaller(role);
      await expect(
        caller.review.acknowledgements({
          reportId: REPORT_ID,
          groupId: GROUP_ID,
        }),
      ).resolves.toEqual([PEER_ACK, OWN_ACK]);
    },
  );

  it.each(["viewer", "head"] as const)(
    "%s cannot read a foreign group",
    async (role) => {
      const { caller, listAcknowledgements } = rosterCaller(role);
      await expect(
        caller.review.acknowledgements({
          reportId: REPORT_ID,
          groupId: FOREIGN_GROUP_ID,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(listAcknowledgements).not.toHaveBeenCalled();
    },
  );

  it("Admin retains the named roster outside their reporting group", async () => {
    const foreignAck = { ...PEER_ACK, groupId: FOREIGN_GROUP_ID };
    const { caller } = rosterCaller("admin", [foreignAck]);
    await expect(
      caller.review.acknowledgements({
        reportId: REPORT_ID,
        groupId: FOREIGN_GROUP_ID,
      }),
    ).resolves.toEqual([foreignAck]);
  });

  it.each([
    ["lead", "FORBIDDEN"],
    [null, "UNAUTHORIZED"],
  ] as const)("%s is denied before the roster read", async (role, code) => {
    const { caller, listAcknowledgements } = rosterCaller(role);
    await expect(
      caller.review.acknowledgements({
        reportId: REPORT_ID,
        groupId: GROUP_ID,
      }),
    ).rejects.toMatchObject({ code });
    expect(listAcknowledgements).not.toHaveBeenCalled();
  });
});
