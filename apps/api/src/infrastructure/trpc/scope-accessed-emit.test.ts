import type { Role } from "@customreport/shared";
import { weeklyReportReadModelSchema } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import type { WeeklyReportServiceResult } from "../../modules/weekly-report/index.js";
import { createAppRouter } from "./trpc.router.js";

// Pins router-level scopeAccessed emit: one event per non-admin signal
// (deduped across products), none for null signal or admin; crossGroup
// is stripped from the public response.

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const CROSS_PRODUCT_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CROSS_PRODUCT_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CROSS_GROUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEST_IP = "test-ip";

function makeReadModel() {
  return weeklyReportReadModelSchema.parse({
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14"),
    periodEnd: new Date("2026-04-18"),
    deadline: new Date("2026-04-17T15:00:00.000Z"),
    periodStatus: "published",
    weekLabel: "W16-2026",
    submissionCount: 1,
    totalLeads: 1,
    hasActiveReminderRule: false,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
  });
}

function makeSession(role: Role) {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    email: `${role}@test.local`,
    name: `${role} user`,
    role,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

function buildCaller(serviceResult: WeeklyReportServiceResult, role: Role) {
  const scopeAccessed = vi.fn();
  const auditLogger = { ...createNullAuditLogger(), scopeAccessed };
  const deps = {
    weeklyReportService: {
      getWeeklyReport: vi.fn(() => Promise.resolve(serviceResult)),
    },
  } as unknown as Parameters<typeof createAppRouter>[0];
  const caller = createAppRouter(deps).createCaller({
    session: makeSession(role),
    logger: createNullLogger(),
    auditLogger,
    ip: TEST_IP,
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, scopeAccessed };
}

function activeResult(
  crossGroup: { productIds: string[]; groupIds: string[] } | null,
): WeeklyReportServiceResult {
  return { status: "active", ...makeReadModel(), crossGroup };
}

describe("weeklyReport.get — scopeAccessed emit", () => {
  it("emits exactly one scopeAccessed when a non-admin read carries the signal", async () => {
    const { caller, scopeAccessed } = buildCaller(
      activeResult({
        productIds: [CROSS_PRODUCT_1],
        groupIds: [CROSS_GROUP_ID],
      }),
      "viewer",
    );

    const result = await caller.weeklyReport.get({});

    expect(scopeAccessed).toHaveBeenCalledTimes(1);
    expect(scopeAccessed).toHaveBeenCalledWith({
      userId: "44444444-4444-4444-8444-444444444444",
      role: "viewer",
      ip: TEST_IP,
      accessedScope: "weeklyReport.project",
      productIds: [CROSS_PRODUCT_1],
      groupIds: [CROSS_GROUP_ID],
      resourceId: REPORT_ID,
    });
    // The internal signal never leaks to tRPC clients.
    expect(result).not.toHaveProperty("crossGroup");
  });

  it("emits ONE event for two cross-group products (per-request dedupe)", async () => {
    const { caller, scopeAccessed } = buildCaller(
      activeResult({
        productIds: [CROSS_PRODUCT_1, CROSS_PRODUCT_2],
        groupIds: [CROSS_GROUP_ID],
      }),
      "lead",
    );

    await caller.weeklyReport.get({});

    expect(scopeAccessed).toHaveBeenCalledTimes(1);
    expect(scopeAccessed.mock.calls[0]?.[0]).toMatchObject({
      productIds: [CROSS_PRODUCT_1, CROSS_PRODUCT_2],
    });
  });

  it("emits nothing when the signal is null (own-group-only read)", async () => {
    const { caller, scopeAccessed } = buildCaller(activeResult(null), "head");

    const result = await caller.weeklyReport.get({});

    expect(scopeAccessed).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("crossGroup");
  });

  it("emits nothing for admin even when the repository produced a signal", async () => {
    const { caller, scopeAccessed } = buildCaller(
      activeResult({
        productIds: [CROSS_PRODUCT_1],
        groupIds: [CROSS_GROUP_ID],
      }),
      "admin",
    );

    await caller.weeklyReport.get({});

    expect(scopeAccessed).not.toHaveBeenCalled();
  });

  it("emits nothing on the no-period path and strips crossGroup", async () => {
    const { caller, scopeAccessed } = buildCaller(
      { status: "no-period", report: null, crossGroup: null },
      "viewer",
    );

    const result = await caller.weeklyReport.get({});

    expect(scopeAccessed).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("crossGroup");
  });
});
