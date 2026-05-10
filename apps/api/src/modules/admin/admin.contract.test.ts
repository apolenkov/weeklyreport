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
