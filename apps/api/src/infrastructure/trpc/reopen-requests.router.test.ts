import type { Role } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import type { AdminTelemetry } from "../../modules/admin/index.js";
import { AdminPrismaRepository } from "../../modules/admin/index.js";
import { ReopenRequestAdminService } from "../../modules/admin/index.js";
import { customreportReopenRequestsTotal } from "../metrics/metrics.registry.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * reopen-request-lifecycle: the three reopen procedures (list / respond /
 * count) are gated to headProcedure (ADR 0008), group-scoped (D8), and the
 * decision is race-safe (D6). Persistence sits behind
 * `ReopenRequestAdminService` (backed by `AdminPrismaRepository`); this suite drives the
 * router → service → repository seam against a mock Prisma so the gate, the
 * where-clause shape (still asserted at the repository boundary the
 * adapter issues), and the race branches are exercised without a DB. The
 * DB-level guarantees (the partial unique index, real concurrency) live in the
 * integration suite.
 */

const GROUP_ID = "99999999-9999-4999-8999-999999999999";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const prometheusTelemetry: AdminTelemetry = {
  recordReopenRequestDecision: (decision) => {
    customreportReopenRequestsTotal.inc({ state: decision });
  },
};

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

interface TxCounts {
  reopenUpdateCount?: number;
  sectionUpdateCount?: number;
}

function makeTx(counts: TxCounts) {
  return {
    reopenRequest: {
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: counts.reopenUpdateCount ?? 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    reportSection: {
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: counts.sectionUpdateCount ?? 1 }),
    },
  };
}

function buildCaller(
  role: Role,
  prismaOverrides: Record<string, unknown> = {},
  txCounts: TxCounts = {},
) {
  const tx = makeTx(txCounts);
  const prisma = {
    reopenRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: REQUEST_ID, reportSectionId: SECTION_ID }),
      ...prismaOverrides,
    },
    $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
      Promise.resolve(cb(tx)),
    ),
  };
  // Keep the service and repository in the test path so assertions cover the
  // same where clauses, transaction branches, and metrics as production.
  const reopenRequestAdminService = new ReopenRequestAdminService(
    new AdminPrismaRepository(prisma as never),
    undefined,
    prometheusTelemetry,
  );
  const deps = {
    prisma,
    reopenRequestAdminService,
  } as unknown as Parameters<typeof createAppRouter>[0];
  const caller = createAppRouter(deps).createCaller({
    session: makeSession(role),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, prisma, tx };
}

async function counterValue(state: string): Promise<number> {
  const snapshot = await customreportReopenRequestsTotal.get();
  const match = snapshot.values.find((v) => String(v.labels.state) === state);
  return match?.value ?? 0;
}

describe("reopen procedures — gate (ADR 0008)", () => {
  it("a head may list and count", async () => {
    const { caller } = buildCaller("head");
    await expect(caller.admin.listReopenRequests({})).resolves.toEqual([]);
    await expect(caller.admin.pendingReopenCount()).resolves.toEqual({
      count: 0,
    });
  });

  it("an admin may list", async () => {
    const { caller } = buildCaller("admin");
    await expect(caller.admin.listReopenRequests({})).resolves.toEqual([]);
  });

  it.each(["lead", "viewer"] as const)(
    "a %s is forbidden on all three procedures",
    async (role) => {
      const { caller } = buildCaller(role);
      await expect(caller.admin.listReopenRequests({})).rejects.toBeInstanceOf(
        TRPCError,
      );
      await expect(caller.admin.pendingReopenCount()).rejects.toBeInstanceOf(
        TRPCError,
      );
      await expect(
        caller.admin.respondReopenRequest({
          id: REQUEST_ID,
          decision: "approved",
        }),
      ).rejects.toBeInstanceOf(TRPCError);
    },
  );
});

function firstCallWhere(fn: ReturnType<typeof vi.fn>): unknown {
  const arg = fn.mock.calls[0]?.[0] as { where?: unknown } | undefined;
  return arg?.where;
}

describe("reopen procedures — group scope (D8)", () => {
  it("a head scopes the list to its own reporting group", async () => {
    const { caller, prisma } = buildCaller("head");
    await caller.admin.listReopenRequests({ status: "pending" });
    const findMany = prisma.reopenRequest.findMany as ReturnType<typeof vi.fn>;
    expect(firstCallWhere(findMany)).toEqual({
      status: "pending",
      reportSection: { author: { reportingGroupId: { in: [GROUP_ID] } } },
    });
  });

  it("an admin list is global ({} scope)", async () => {
    const { caller, prisma } = buildCaller("admin");
    await caller.admin.listReopenRequests({ status: "pending" });
    const findMany = prisma.reopenRequest.findMany as ReturnType<typeof vi.fn>;
    expect(firstCallWhere(findMany)).toEqual({
      status: "pending",
      reportSection: {},
    });
  });

  it("a head count is group-scoped", async () => {
    const { caller, prisma } = buildCaller("head");
    await caller.admin.pendingReopenCount();
    const count = prisma.reopenRequest.count as ReturnType<typeof vi.fn>;
    expect(firstCallWhere(count)).toEqual({
      status: "pending",
      reportSection: { author: { reportingGroupId: { in: [GROUP_ID] } } },
    });
  });

  it("a head deciding an out-of-group request by id is rejected", async () => {
    const { caller } = buildCaller("head", {
      // scoped findFirst finds nothing → out of group.
      findFirst: vi.fn().mockResolvedValue(null),
    });
    await expect(
      caller.admin.respondReopenRequest({
        id: REQUEST_ID,
        decision: "approved",
      }),
    ).rejects.toThrow("Reopen request not found.");
  });
});

describe("respondReopenRequest — race-safe decision (D6)", () => {
  it("a winning approve flips the section and increments the funnel once", async () => {
    const before = await counterValue("approved");
    const { caller, tx } = buildCaller(
      "head",
      {},
      { reopenUpdateCount: 1, sectionUpdateCount: 1 },
    );

    const result = await caller.admin.respondReopenRequest({
      id: REQUEST_ID,
      decision: "approved",
    });

    expect(result).toMatchObject({
      success: true,
      decision: "approved",
      staleAutoClosed: false,
    });
    expect(tx.reportSection.updateMany).toHaveBeenCalledTimes(1);
    expect(await counterValue("approved")).toBe(before + 1);
  });

  it("a winning reject leaves the section untouched and increments rejected", async () => {
    const before = await counterValue("rejected");
    const { caller, tx } = buildCaller("head", {}, { reopenUpdateCount: 1 });

    const result = await caller.admin.respondReopenRequest({
      id: REQUEST_ID,
      decision: "rejected",
    });

    expect(result).toMatchObject({ decision: "rejected" });
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(await counterValue("rejected")).toBe(before + 1);
  });

  it("the loser of a concurrent decision reports 'Already processed' and skews no metric", async () => {
    const before = await counterValue("approved");
    const { caller } = buildCaller("head", {}, { reopenUpdateCount: 0 });

    await expect(
      caller.admin.respondReopenRequest({
        id: REQUEST_ID,
        decision: "approved",
      }),
    ).rejects.toThrow("Already processed.");

    expect(await counterValue("approved")).toBe(before);
  });

  it("approving a request whose section was already revoked auto-closes it without a metric", async () => {
    const before = await counterValue("approved");
    const { caller, tx } = buildCaller(
      "head",
      {},
      { reopenUpdateCount: 1, sectionUpdateCount: 0 },
    );

    const result = await caller.admin.respondReopenRequest({
      id: REQUEST_ID,
      decision: "approved",
    });

    expect(result).toMatchObject({
      success: true,
      decision: "rejected",
      staleAutoClosed: true,
    });
    // The stale request is made terminal (auto-close), no section flip.
    expect(tx.reopenRequest.update).toHaveBeenCalledTimes(1);
    expect(await counterValue("approved")).toBe(before);
  });
});
