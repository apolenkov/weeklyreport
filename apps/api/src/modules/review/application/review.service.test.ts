import type { SubmissionDashboardRow, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullAuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import { type ReviewRepository, ReviewService } from "./review.service";

const reportId = "22222222-2222-4222-8222-222222222222";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000002",
  email: "lead1@customreport.local",
  name: "Lead 1",
  role: "lead",
  activeReportId: reportId,
  activeReportSectionId: "33333333-3333-4333-8333-333333333333",
};

const unsortedRows: SubmissionDashboardRow[] = [
  {
    leadId: "00000000-0000-4000-8000-000000000012",
    leadName: "Lead 2",
    role: "lead",
    projectNames: ["Project 2"],
    status: "submitted",
    submittedAt: new Date("2026-04-09T10:00:00.000Z"),
  },
  {
    leadId: "00000000-0000-4000-8000-000000000013",
    leadName: "Lead 3",
    role: "lead",
    projectNames: ["Project 3"],
    status: "draft",
    submittedAt: null,
  },
  {
    leadId: "00000000-0000-4000-8000-000000000011",
    leadName: "Lead 1",
    role: "lead",
    projectNames: ["Project 1"],
    status: "draft",
    submittedAt: null,
  },
];

function createRepository(rows: SubmissionDashboardRow[]): ReviewRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ReviewRepository contract (no awaitable work in the stub)
    async getSubmissionDashboard(activeReportId: string, _session) {
      if (activeReportId !== reportId) {
        return [];
      }

      return structuredClone(rows);
    },
  };
}

const headSessionWithGroup: UserSession = {
  ...headSession,
  reportingGroupId: "a0000000-0000-4000-8000-000000000a01",
};

const viewerSessionEmptyAccess: UserSession = {
  userId: "00000000-0000-4000-8000-000000000003",
  email: "viewer@customreport.local",
  name: "Viewer",
  role: "viewer",
  activeReportId: reportId,
  activeReportSectionId: null,
  viewerGroupAccess: [],
};

describe("ReviewService", () => {
  it("returns one typed row per lead for the active report", async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    await expect(
      service.getSubmissionDashboard(reportId, headSession),
    ).resolves.toMatchObject([
      {
        leadName: "Lead 1",
        projectNames: ["Project 1"],
        status: "draft",
      },
      {
        leadName: "Lead 3",
        projectNames: ["Project 3"],
        status: "draft",
      },
      {
        leadName: "Lead 2",
        projectNames: ["Project 2"],
        status: "submitted",
      },
    ]);
  });

  it("sorts outstanding draft rows before submitted rows and then by lead name", async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    const rows = await service.getSubmissionDashboard(reportId, headSession);

    expect(
      rows.map(
        (row: SubmissionDashboardRow) => `${row.status}:${row.leadName}`,
      ),
    ).toEqual(["draft:Lead 1", "draft:Lead 3", "submitted:Lead 2"]);
  });

  it("rejects non-head access before returning dashboard data", async () => {
    const service = new ReviewService(createRepository(unsortedRows));
    const caller = buildReviewCaller(service, leadSession);

    await expect(caller.review.dashboard()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes the session through to the repository so scope filter applies", async () => {
    let capturedSession: unknown;
    const spyRepo: ReviewRepository = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ReviewRepository contract (no awaitable work in the stub)
      async getSubmissionDashboard(_id, session) {
        capturedSession = session;
        return [];
      },
    };
    const service = new ReviewService(spyRepo);
    await service.getSubmissionDashboard(reportId, headSessionWithGroup);
    expect(capturedSession).toMatchObject({
      role: "head",
      reportingGroupId: "a0000000-0000-4000-8000-000000000a01",
    });
  });

  it("viewer with empty viewerGroupAccess gets zero rows back (caller responsibility, repo still gets session)", async () => {
    let capturedSession: unknown;
    const spyRepo: ReviewRepository = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ReviewRepository contract (no awaitable work in the stub)
      async getSubmissionDashboard(_id, session) {
        capturedSession = session;
        return [];
      },
    };
    const service = new ReviewService(spyRepo);
    const result = await service.getSubmissionDashboard(
      reportId,
      viewerSessionEmptyAccess,
    );
    expect(result).toEqual([]);
    expect(capturedSession).toMatchObject({
      role: "viewer",
      viewerGroupAccess: [],
    });
  });
});

// Drive the live review.dashboard procedure so gating hits the wired path.
function buildReviewCaller(service: ReviewService, session: UserSession) {
  const deps = {
    weeklyReportService: {
      getCurrentEditableId: vi.fn(() => Promise.resolve(reportId)),
    },
    reviewService: service,
  } as unknown as Parameters<typeof createAppRouter>[0];

  return createAppRouter(deps).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("review.dashboard (live headProcedure)", () => {
  it("allows a head session to read the active report dashboard", async () => {
    const service = new ReviewService(createRepository(unsortedRows));
    const caller = buildReviewCaller(service, headSession);

    await expect(caller.review.dashboard()).resolves.toHaveLength(3);
  });
});
