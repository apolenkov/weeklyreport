import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import type { LeadFormService } from "../../../modules/report-sections/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { createLeadFormRouter } from "./lead-form.router.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  current: {
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-24T00:00:00.000Z"),
    periodEnd: new Date("2026-08-30T23:59:59.999Z"),
    section: {
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: USER_ID,
      authorName: "Lead One",
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    },
  },
  predecessor: {
    availability: "unavailable" as const,
    reason: "no_predecessor" as const,
  },
};

function caller(
  getStatusOverview: Pick<
    LeadFormService,
    "getStatusOverview"
  >["getStatusOverview"],
) {
  const leadFormService = {
    getStatusOverview,
  } satisfies Pick<LeadFormService, "getStatusOverview">;
  const router = createLeadFormRouter(
    createStubAppRouterDeps({ leadFormService }),
  );
  return router.createCaller({
    session: {
      userId: USER_ID,
      email: "lead@test.local",
      name: "Lead One",
      role: "lead",
      viewerGroupAccess: [],
      activeReportId: REPORT_ID,
      activeReportSectionId: SECTION_ID,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("leadForm.statusOverview", () => {
  it("validates input and output on the canonical protected query", async () => {
    const getStatusOverview = vi.fn().mockResolvedValue(output);

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: REPORT_ID }),
    ).resolves.toEqual(output);
    expect(getStatusOverview).toHaveBeenCalledWith(
      REPORT_ID,
      USER_ID,
      "lead",
      undefined,
    );
  });

  it("rejects malformed input before calling the read module", async () => {
    const getStatusOverview = vi.fn();

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(getStatusOverview).not.toHaveBeenCalled();
  });

  it("rejects malformed module output at the transport boundary", async () => {
    const getStatusOverview = vi.fn().mockResolvedValue({
      ...output,
      predecessor: {
        availability: "available",
        source: "submitted",
        reportId: REPORT_ID,
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        periodEnd: new Date("2026-08-23T23:59:59.999Z"),
        section: { status: "draft" },
      },
    });

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: REPORT_ID }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
