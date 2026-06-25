import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * viewer-live-status (task 3.1 / Decision 5): `compiledHistory` is a shared
 * `anyRoleProcedure`, so the viewer-only `periodStatus = "published"` History
 * filter MUST be role-conditional. It applies to BOTH the list query and the
 * archive-count query (else the list and the count disagree for the viewer), so
 * a reopened period (legacy `status="published"`, `periodStatus="reopened"`) is
 * never shown to the viewer as a gate-rejected broken link — while head and lead
 * History stay unchanged (a reopened period still listed + counted).
 */

const GROUP_A = "a1111111-1111-4111-8111-111111111111";

function buildCaller(
  findMany: ReturnType<typeof vi.fn>,
  count: ReturnType<typeof vi.fn>,
  session: UserSession,
) {
  const deps = {
    prisma: { report: { findMany, count } },
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

const viewerSession: UserSession = {
  userId: "c3333333-3333-4333-8333-333333333333",
  email: "viewer@test.local",
  name: "Viewer",
  role: "viewer",
  viewerGroupAccess: [GROUP_A],
  activeReportId: null,
  activeReportSectionId: null,
};

const headSession: UserSession = {
  userId: "e5555555-5555-4555-8555-555555555555",
  email: "head@test.local",
  name: "Head",
  role: "head",
  viewerGroupAccess: [],
  activeReportId: null,
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: "d4444444-4444-4444-8444-444444444444",
  email: "lead@test.local",
  name: "Lead",
  role: "lead",
  reportingGroupId: GROUP_A,
  viewerGroupAccess: [],
  activeReportId: null,
  activeReportSectionId: null,
};

describe("reports.compiledHistory — viewer published-only History filter (task 3.1)", () => {
  interface QueryArg {
    where: Record<string, unknown>;
  }

  it("applies periodStatus='published' to BOTH the list and archive-count for a viewer", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const caller = buildCaller(findMany, count, viewerSession);

    await caller.reports.compiledHistory({ includeArchive: true });

    const listWhere = findMany.mock.calls[0]?.[0].where;
    const countWhere = count.mock.calls[0]?.[0].where;
    expect(listWhere).toMatchObject({ periodStatus: "published" });
    expect(countWhere).toMatchObject({ periodStatus: "published" });
  });

  it("does NOT apply the periodStatus filter for a head (non-regression)", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const caller = buildCaller(findMany, count, headSession);

    await caller.reports.compiledHistory({ includeArchive: true });

    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty(
      "periodStatus",
    );
    expect(count.mock.calls[0]?.[0].where).not.toHaveProperty("periodStatus");
  });

  it("does NOT apply the periodStatus filter for a lead (non-regression)", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const caller = buildCaller(findMany, count, leadSession);

    await caller.reports.compiledHistory({ includeArchive: true });

    const listWhere = findMany.mock.calls[0]?.[0].where;
    expect(listWhere).not.toHaveProperty("periodStatus");
    // Lead History scopes sections by author, unchanged.
    expect(listWhere).toMatchObject({
      sections: { some: { authorId: leadSession.userId } },
    });
  });
});
