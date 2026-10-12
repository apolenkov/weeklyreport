import { TRPCError } from "@trpc/server";
import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import type { AdminTelemetry } from "../../modules/admin/index.js";
import { AdminPrismaRepository } from "../../modules/admin/index.js";
import { ReopenRequestAdminService } from "../../modules/admin/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { weeklyreportReopenRequestsTotal } from "../metrics/metrics.registry.js";
import { createAppRouter } from "./trpc.router.js";

// Reopen list/respond/count: headProcedure, group-scoped, race-safe decision.
// Router→service→repo against mock Prisma; DB guarantees in the integration suite.

const GROUP_ID = "99999999-9999-4999-8999-999999999999";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const prometheusTelemetry: AdminTelemetry = {
  recordReopenRequestDecision: (decision) => {
    weeklyreportReopenRequestsTotal.inc({ state: decision });
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
  findFirstResult?: unknown;
}

function makeTx(counts: TxCounts, role: Role) {
  return {
    $queryRaw: vi.fn((strings: TemplateStringsArray, id?: string) => {
      if (strings.join("").includes('FROM "User"')) {
        return Promise.resolve([{ id }]);
      }
      return Promise.resolve([
        {
          id: "report-1",
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
      ]);
    }),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isActive: true,
        role,
        reportingGroupId: role === "admin" ? null : GROUP_ID,
      }),
    },
    reopenRequest: {
      // The scoped re-load inside the decision transaction returns the row
      // under decision; `updateMany` below models the state transition.
      findFirst: vi.fn().mockResolvedValue(
        counts.findFirstResult === undefined
          ? {
              id: REQUEST_ID,
              reportSectionId: SECTION_ID,
              reportSection: { authorId: AUTHOR_ID },
            }
          : counts.findFirstResult,
      ),
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
  const tx = makeTx(txCounts, role);
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
    createNullLogger(),
    prometheusTelemetry,
  );
  const deps = createStubAppRouterDeps({
    prisma,
    reopenRequestAdminService,
  });
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
  const snapshot = await weeklyreportReopenRequestsTotal.get();
  const match = snapshot.values.find((v) => String(v.labels.state) === state);
  return match?.value ?? 0;
}

describe("reopen procedures — group-scoped gate", () => {
  it("a head may list and count", async () => {
    const { caller, prisma } = buildCaller("head");
    await expect(caller.admin.listReopenRequests()).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(prisma.reopenRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
    await expect(caller.admin.pendingReopenCount()).resolves.toEqual({
      count: 0,
    });
  });

  it("an admin may list", async () => {
    const { caller } = buildCaller("admin");
    await expect(caller.admin.listReopenRequests({})).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
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

  it("accepts the forward infinite-query transport input through the tRPC caller", async () => {
    const { caller, prisma } = buildCaller("admin");
    const cursor = {
      id: REQUEST_ID,
      createdAt: "2026-09-06T08:30:00.000Z",
    };

    await caller.admin.listReopenRequests({
      status: "rejected",
      limit: 7,
      cursor,
      search: "  weekly 36  ",
      direction: "forward",
    });

    const findMany = prisma.reopenRequest.findMany as ReturnType<typeof vi.fn>;
    const call = findMany.mock.calls[0]?.[0] as
      | {
          where?: { status?: unknown; AND?: unknown[] };
          take?: unknown;
        }
      | undefined;
    expect(call?.where?.status).toBe("rejected");
    expect(call?.where?.AND?.[0]).toEqual({
      OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        {
          createdAt: new Date(cursor.createdAt),
          id: { lt: cursor.id },
        },
      ],
    });
    expect(call?.where?.AND?.[1]).toEqual({
      OR: [
        {
          requestedBy: {
            name: { contains: "weekly 36", mode: "insensitive" },
          },
        },
        {
          requestedBy: {
            email: { contains: "weekly 36", mode: "insensitive" },
          },
        },
        {
          reportSection: {
            report: {
              weekLabel: {
                contains: "weekly 36",
                mode: "insensitive",
              },
            },
          },
        },
        {
          reason: {
            contains: "weekly 36",
            mode: "insensitive",
          },
        },
        {
          reviewNote: {
            contains: "weekly 36",
            mode: "insensitive",
          },
        },
      ],
    });
    expect(call?.take).toBe(8);
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
    const { caller } = buildCaller(
      "head",
      {},
      // The scoped findFirst inside the decision transaction finds nothing →
      // out of group.
      { findFirstResult: null },
    );
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
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.$queryRaw.mock.calls.slice(0, 2).map((call) => call[1])).toEqual([
      USER_ID,
      AUTHOR_ID,
    ]);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { isActive: true, role: true, reportingGroupId: true },
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
