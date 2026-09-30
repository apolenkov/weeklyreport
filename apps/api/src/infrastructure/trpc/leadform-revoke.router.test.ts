import type { Role } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import { LeadFormService } from "../../modules/report-sections/index.js";
import { LeadFormPrismaRepository } from "../../modules/report-sections/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "./trpc.router.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../../modules/report-sections/application/report-sections-telemetry.port.js";

// Revoke procedures are headProcedures whose object authz binds to the
// caller's reporting group; exercise router scope threading end to end.

const GROUP_ID = "99999999-9999-4999-8999-999999999999";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

function makeSession(role: Role) {
  return {
    userId: USER_ID,
    email: `${role}@test.local`,
    name: `${role} user`,
    role,
    reportingGroupId: GROUP_ID,
    viewerGroupAccess: [GROUP_ID],
    activeReportId: null,
    activeReportSectionId: null,
  };
}

function buildCaller(
  role: Role,
  prismaOverrides: Record<string, unknown> = {},
) {
  const reportSection = {
    // Default: scoped read finds nothing (out-of-group / missing).
    findFirst: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    ...prismaOverrides,
  };
  const prisma = {
    reportSection,
    $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
      Promise.resolve(
        cb({
          $queryRaw: vi.fn(() =>
            Promise.resolve([
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
          ),
          reportSection,
        }),
      ),
    ),
  };
  const repo = new LeadFormPrismaRepository(prisma as never);
  const leadFormService = new LeadFormService(
    repo,
    NOOP_REPORT_SECTIONS_TELEMETRY,
  );
  const deps = createStubAppRouterDeps({ leadFormService });
  const caller = createAppRouter(deps).createCaller({
    session: makeSession(role),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, reportSection };
}

function firstCallWhere(fn: ReturnType<typeof vi.fn>): unknown {
  const arg = fn.mock.calls[0]?.[0] as { where?: unknown } | undefined;
  return arg?.where;
}

const HEAD_SCOPE = { author: { reportingGroupId: { in: [GROUP_ID] } } };

describe("leadForm.revoke / revokeAllSubmitted — role gate", () => {
  it.each(["lead", "viewer"] as const)(
    "a %s is forbidden on both revoke procedures",
    async (role) => {
      const { caller } = buildCaller(role);
      await expect(
        caller.leadForm.revoke({ reportSectionId: SECTION_ID }),
      ).rejects.toBeInstanceOf(TRPCError);
      await expect(
        caller.leadForm.revokeAllSubmitted({ reportId: REPORT_ID }),
      ).rejects.toBeInstanceOf(TRPCError);
    },
  );
});

describe("leadForm.revoke — single-section group scope", () => {
  it("a head's scoped read carries the group-scope author filter; an out-of-group id is not-found", async () => {
    const { caller, reportSection } = buildCaller("head");

    await expect(
      caller.leadForm.revoke({ reportSectionId: SECTION_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(firstCallWhere(reportSection.findFirst)).toEqual({
      id: SECTION_ID,
      ...HEAD_SCOPE,
    });
    // No write when the scoped read found nothing.
    expect(reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("an admin's scoped read is global (no author filter)", async () => {
    const { caller, reportSection } = buildCaller("admin");

    await expect(
      caller.leadForm.revoke({ reportSectionId: SECTION_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(firstCallWhere(reportSection.findFirst)).toEqual({ id: SECTION_ID });
  });
});

describe("leadForm.revokeAllSubmitted — bulk group scope", () => {
  it("a head's bulk write is scoped to its own group and returns the count", async () => {
    const { caller, reportSection } = buildCaller("head");

    const result = await caller.leadForm.revokeAllSubmitted({
      reportId: REPORT_ID,
    });

    expect(result).toEqual({ success: true, revokedCount: 2 });
    expect(firstCallWhere(reportSection.updateMany)).toEqual({
      reportId: REPORT_ID,
      status: "submitted",
      // Lifecycle gate: only non-archived editable reports match.
      report: {
        archived: false,
        periodStatus: { in: ["open", "reopened"] },
      },
      ...HEAD_SCOPE,
    });
  });

  it("an admin's bulk write is global (no author filter)", async () => {
    const { caller, reportSection } = buildCaller("admin");

    await caller.leadForm.revokeAllSubmitted({ reportId: REPORT_ID });

    expect(firstCallWhere(reportSection.updateMany)).toEqual({
      reportId: REPORT_ID,
      status: "submitted",
      report: {
        archived: false,
        periodStatus: { in: ["open", "reopened"] },
      },
    });
  });
});
