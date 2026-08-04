import { describe, expect, it, vi } from "vitest";

import { adminProcedure } from "../../infrastructure/trpc/trpc.middleware.js";
import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import type { ReminderAdminService } from "./reminder-admin.service.js";

// Contract guarantees for the ReminderPolicy tRPC surface: the three procedures
// exist under `admin`, each is built on `adminProcedure` (admin-only), and the
// per-rule writers throw METHOD_NOT_SUPPORTED. Router-shape inspection only.

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
    typeof node._def === "object" &&
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

describe("admin reminder-policy contract", () => {
  // Stub deps — `createAppRouter` does not invoke any handler at
  // construction time, so an empty cast satisfies the type signature.
  const stubDeps = createStubAppRouterDeps();
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it.each([
    "admin.listPolicies",
    "admin.savePolicy",
    "admin.removePolicy",
  ] as const)("exposes %s as an adminProcedure", (procedurePath) => {
    expect(isAdminProcedure(getProcedure(router, procedurePath))).toBe(true);
  });

  // A real router over a spied reminder service, so each tombstone test can
  // assert the deprecated handler never reaches the service behind it.
  function callerOverReminderService(
    reminderAdminService: Partial<ReminderAdminService>,
  ) {
    const realDeps = createStubAppRouterDeps({ reminderAdminService });

    return createAppRouter(realDeps).createCaller({
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
    });
  }

  it("admin.saveReminderRule write path throws METHOD_NOT_SUPPORTED", async () => {
    const upsertSpy = vi.fn();
    const caller = callerOverReminderService({
      upsertReminderRule: upsertSpy,
    });

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
      message: expect.stringContaining("admin.savePolicy") as unknown,
    } as Record<string, unknown>);

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  // Rules die only with their policy, so the per-rule delete must refuse in the
  // same way its save twin does — otherwise the surface contradicts itself.
  it("admin.deleteReminderRule write path throws METHOD_NOT_SUPPORTED", async () => {
    const removeSpy = vi.fn();
    const caller = callerOverReminderService({
      removeReminderRule: removeSpy,
    });

    await expect(
      caller.admin.deleteReminderRule({
        ruleId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_SUPPORTED",
      message: expect.stringContaining("reminder policy") as unknown,
    } as Record<string, unknown>);

    expect(removeSpy).not.toHaveBeenCalled();
  });
});

// Group <-> Product M:M contract guarantees: the 5 procedures exist under
// `admin` and each is built on `adminProcedure`, preserving role coverage
// (head/admin only). Router-shape inspection, no handler invoked.
describe("admin group-product contract", () => {
  const stubDeps = createStubAppRouterDeps();
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it.each([
    "admin.attachProductToGroup",
    "admin.detachProductFromGroup",
    "admin.listGroupProducts",
    "admin.listProductGroups",
    "admin.listProductGroupOwnership",
  ] as const)("exposes %s as an adminProcedure", (procedurePath) => {
    expect(isAdminProcedure(getProcedure(router, procedurePath))).toBe(true);
  });
});

// admin.snapshot is admin-only: running it on headProcedure would leak every
// user's data across reporting groups. This gate keeps the cross-group scope
// leak closed.
describe("admin.snapshot group-scope gate", () => {
  const stubDeps = createStubAppRouterDeps();
  const appRouter = createAppRouter(stubDeps);
  const router = appRouter as unknown as {
    _def: { procedures: Record<string, unknown> };
  };

  it("admin.snapshot is guarded by adminProcedure (not headProcedure)", () => {
    const proc = getProcedure(router, "admin.snapshot");
    expect(isAdminProcedure(proc)).toBe(true);
  });
});
