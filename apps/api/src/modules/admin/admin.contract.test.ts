import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { adminProcedure } from "../../infrastructure/trpc/trpc.middleware.js";
import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import type { AdminService } from "./admin.service.js";

/**
 * UFB-036 (Phase 44-02): contract guarantees for the new ReminderPolicy
 * tRPC surface — `admin.listPolicies`, `admin.savePolicy`,
 * `admin.removePolicy` — and the soft-deprecation of `admin.saveReminderRule`.
 *
 * Contract assertions:
 *   1. The three new procedures exist under the `admin` namespace.
 *   2. Each is built on `adminProcedure` (admin-only, NOT head — UFB-038).
 *   3. `admin.saveReminderRule` write path throws TRPCError with code
 *      METHOD_NOT_SUPPORTED and a message mentioning `admin.savePolicy`.
 *
 * The tests inspect the router shape directly (no transport / Redis /
 * Prisma) — the same trick the AUTH-03 role-coverage gate uses.
 */

// Capture adminProcedure's middleware-chain identity so we can compare
// router leaves against it. The resolver function is the last entry, so
// we slice it off.
const ADMIN_CHAIN = (
  adminProcedure.query(() => undefined) as unknown as {
    _def: { middlewares: unknown[] };
  }
)._def.middlewares.slice(0, -1);

interface LeafProcedure {
  _def: { middlewares: readonly unknown[] };
}

function isLeafProcedure(node: unknown): node is LeafProcedure {
  return (
    (typeof node === "object" || typeof node === "function") &&
    node !== null &&
    "_def" in node &&
    typeof (node as { _def: unknown })._def === "object" &&
    Array.isArray(
      (node as { _def: { middlewares?: unknown } })._def.middlewares,
    )
  );
}

function isAdminProcedure(leaf: LeafProcedure): boolean {
  if (leaf._def.middlewares.length < ADMIN_CHAIN.length) return false;
  return ADMIN_CHAIN.every((mw, i) => leaf._def.middlewares[i] === mw);
}

function getProcedure(
  router: { _def: { procedures: Record<string, unknown> } },
  path: string,
): LeafProcedure {
  const node = router._def.procedures[path];
  if (!isLeafProcedure(node)) {
    throw new Error(`Procedure '${path}' not found in router.`);
  }
  return node;
}

describe("admin reminder-policy contract (UFB-036, Phase 44-02)", () => {
  // Stub deps — `createAppRouter` does not invoke any handler at
  // construction time, so an empty cast satisfies the type signature.
  const stubDeps = {} as Parameters<typeof createAppRouter>[0];
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it("exposes admin.listPolicies as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.listPolicies");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("exposes admin.savePolicy as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.savePolicy");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("exposes admin.removePolicy as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.removePolicy");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("admin.saveReminderRule write path throws METHOD_NOT_SUPPORTED", async () => {
    // Build a real router with an `adminService` whose `upsertReminderRule`
    // is spied so we can assert the deprecated handler never reaches it.
    const upsertSpy = vi.fn();
    const stubAdminService = {
      upsertReminderRule: upsertSpy,
    } as unknown as AdminService;
    const realDeps = {
      adminService: stubAdminService,
    } as unknown as Parameters<typeof createAppRouter>[0];
    const realRouter = createAppRouter(realDeps);

    const caller = realRouter.createCaller({
      session: {
        userId: "00000000-0000-4000-8000-000000000099",
        email: "admin@customreport.local",
        name: "Admin User",
        role: "admin" as const,
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    } as unknown as Parameters<typeof realRouter.createCaller>[0]);

    await expect(
      caller.admin.saveReminderRule({
        id: "11111111-1111-4111-8111-111111111111",
        reportId: "22222222-2222-4222-8222-222222222222",
        kind: "deadline",
        fireAt: new Date("2026-04-17T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      }),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_SUPPORTED",
      message: expect.stringContaining("admin.savePolicy"),
    });

    expect(upsertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UFB-054 (Phase 56-B): Group ↔ Product M:M contract guarantees
// ---------------------------------------------------------------------------
//
// Contract assertions:
//   1. The 4 new procedures exist under the `admin` namespace.
//   2. Each is built on `adminProcedure` so role coverage is preserved
//      (head/admin only — leads and viewers cannot call them).
//
// The shape inspection is identical to the reminder-policy contract
// above and intentionally does not invoke a handler — the router is
// constructed against stub deps and inspected structurally.
// ---------------------------------------------------------------------------

describe("admin group-product contract (UFB-054, Phase 56-B)", () => {
  const stubDeps = {} as Parameters<typeof createAppRouter>[0];
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it("exposes admin.attachProductToGroup as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.attachProductToGroup");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("exposes admin.detachProductFromGroup as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.detachProductFromGroup");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("exposes admin.listGroupProducts as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.listGroupProducts");
    expect(isAdminProcedure(proc)).toBe(true);
  });

  it("exposes admin.listProductGroups as an adminProcedure", () => {
    const proc = getProcedure(router, "admin.listProductGroups");
    expect(isAdminProcedure(proc)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GROUP-SCOPE-01: admin.snapshot is admin-only (UFB-038 gate)
// ---------------------------------------------------------------------------
//
// Regression guard for fix-head-dashboard-group-scope (PRJ-2 UAT debt).
//
// Root cause: prior to UFB-038, admin.snapshot used headProcedure which let
// head users call it and see ALL users regardless of their reporting group.
// UFB-038 (Phase 44-B) switched the endpoint to adminProcedure (admin-only),
// eliminating cross-group user leakage from the admin panel for heads.
//
// This test asserts the gate is still in place so a future refactor cannot
// accidentally revert to headProcedure and re-open the leak.
// ---------------------------------------------------------------------------

describe("admin.snapshot group-scope gate (GROUP-SCOPE-01)", () => {
  const stubDeps = {} as Parameters<typeof createAppRouter>[0];
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it("admin.snapshot is guarded by adminProcedure (not headProcedure)", () => {
    const proc = getProcedure(router, "admin.snapshot");
    expect(isAdminProcedure(proc)).toBe(true);
  });
});
