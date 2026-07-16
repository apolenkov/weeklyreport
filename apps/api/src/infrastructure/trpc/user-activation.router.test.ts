import type { Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * admin.deactivateUser / admin.activateUser promise, in their docstrings, to
 * update the Redis revoked-set fast path alongside the Prisma `isActive`
 * write. This suite pins the router-side half of that promise: when a
 * `sessionRevocationService` is wired into RouterDeps, deactivation revokes
 * and re-activation restores, each AFTER the authoritative DB write. (The
 * production wiring itself lives in `main.ts`, which must pass the
 * DI-provided instance — the fast path is dead code without it.)
 */

const USER_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_ID = "44444444-4444-4444-8444-444444444444";

function makeSession(role: Role) {
  return {
    userId: USER_ID,
    email: `${role}@test.local`,
    name: `${role} user`,
    role,
    viewerGroupAccess: [],
    activeReportId: null,
    activeReportSectionId: null,
  };
}

function buildCaller(role: Role) {
  const snapshotAdminService = {
    deactivateUser: vi.fn().mockResolvedValue({ success: true }),
    activateUser: vi.fn().mockResolvedValue({ success: true }),
  };
  const sessionRevocationService = {
    revokeSession: vi.fn().mockResolvedValue(undefined),
    restoreSession: vi.fn().mockResolvedValue(undefined),
  };
  const deps = {
    snapshotAdminService,
    sessionRevocationService,
  } as unknown as Parameters<typeof createAppRouter>[0];
  const caller = createAppRouter(deps).createCaller({
    session: makeSession(role),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, snapshotAdminService, sessionRevocationService };
}

describe("admin.deactivateUser — session revocation wiring", () => {
  it("revokes the session after the DB write, for the same user", async () => {
    const { caller, snapshotAdminService, sessionRevocationService } =
      buildCaller("admin");

    await expect(
      caller.admin.deactivateUser({ userId: TARGET_ID }),
    ).resolves.toEqual({ success: true });

    expect(snapshotAdminService.deactivateUser).toHaveBeenCalledWith(TARGET_ID);
    expect(sessionRevocationService.revokeSession).toHaveBeenCalledWith(
      TARGET_ID,
    );
    const dbOrder =
      snapshotAdminService.deactivateUser.mock.invocationCallOrder[0] ??
      Infinity;
    const revokeOrder =
      sessionRevocationService.revokeSession.mock.invocationCallOrder[0] ?? 0;
    expect(dbOrder).toBeLessThan(revokeOrder);
  });
});

describe("admin.activateUser — session restoration wiring", () => {
  it("restores the session after the DB write, for the same user", async () => {
    const { caller, snapshotAdminService, sessionRevocationService } =
      buildCaller("admin");

    await expect(
      caller.admin.activateUser({ userId: TARGET_ID }),
    ).resolves.toEqual({ success: true });

    expect(snapshotAdminService.activateUser).toHaveBeenCalledWith(TARGET_ID);
    expect(sessionRevocationService.restoreSession).toHaveBeenCalledWith(
      TARGET_ID,
    );
    const dbOrder =
      snapshotAdminService.activateUser.mock.invocationCallOrder[0] ?? Infinity;
    const restoreOrder =
      sessionRevocationService.restoreSession.mock.invocationCallOrder[0] ?? 0;
    expect(dbOrder).toBeLessThan(restoreOrder);
  });
});
