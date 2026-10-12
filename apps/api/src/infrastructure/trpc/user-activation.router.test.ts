import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  SessionRevocationService,
  SnapshotAdminService,
} from "../../modules/admin/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAdminUsersProcedures } from "./routers/admin/users.procedures.js";
import { router } from "./trpc.middleware.js";
import { createAppRouter } from "./trpc.router.js";

// Pins router-side Redis revoke/restore after the Prisma isActive write
// when sessionRevocationService is wired. Production wiring is in main.ts.

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
  const deactivateUser = vi.fn().mockResolvedValue({ success: true });
  const activateUser = vi.fn().mockResolvedValue({ success: true });
  const snapshotAdminService = Object.assign(
    Object.create(SnapshotAdminService.prototype) as SnapshotAdminService,
    {
      deactivateUser,
      activateUser,
    } satisfies Pick<SnapshotAdminService, "activateUser" | "deactivateUser">,
  );
  const revokeSession = vi.fn().mockResolvedValue(undefined);
  const restoreSession = vi.fn().mockResolvedValue(undefined);
  const sessionRevocationService = Object.assign(
    Object.create(
      SessionRevocationService.prototype,
    ) as SessionRevocationService,
    {
      revokeSession,
      restoreSession,
    } satisfies Pick<
      SessionRevocationService,
      "restoreSession" | "revokeSession"
    >,
  );
  const caller = router(
    createAdminUsersProcedures({
      snapshotAdminService,
      sessionRevocationService,
    }),
  ).createCaller({
    session: makeSession(role),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return {
    caller,
    deactivateUser,
    activateUser,
    revokeSession,
    restoreSession,
  };
}

describe("admin.deactivateUser — session revocation wiring", () => {
  it("revokes the session after the DB write, for the same user", async () => {
    const { caller, deactivateUser, revokeSession } = buildCaller("admin");

    await expect(caller.deactivateUser({ userId: TARGET_ID })).resolves.toEqual(
      { success: true },
    );

    expect(deactivateUser).toHaveBeenCalledWith(TARGET_ID, USER_ID);
    expect(revokeSession).toHaveBeenCalledWith(TARGET_ID);
    const dbOrder = deactivateUser.mock.invocationCallOrder[0] ?? Infinity;
    const revokeOrder = revokeSession.mock.invocationCallOrder[0] ?? 0;
    expect(dbOrder).toBeLessThan(revokeOrder);
  });

  it("fails loud when revocation is unwired — revocation is never skipped silently", async () => {
    const deactivateUser = vi.fn().mockResolvedValue({ success: true });
    const snapshotAdminService = Object.assign(
      Object.create(SnapshotAdminService.prototype) as SnapshotAdminService,
      {
        deactivateUser,
      } satisfies Pick<SnapshotAdminService, "deactivateUser">,
    );
    const caller = router(
      createAdminUsersProcedures({
        snapshotAdminService,
        sessionRevocationService:
          undefined as unknown as SessionRevocationService,
      }),
    ).createCaller({
      session: makeSession("admin"),
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(
      caller.deactivateUser({ userId: TARGET_ID }),
    ).rejects.toThrow();
    // The DB deactivation ran; only the mandatory revocation failed loud.
    expect(deactivateUser).toHaveBeenCalledWith(TARGET_ID, USER_ID);
  });
});

describe("admin.activateUser — session restoration wiring", () => {
  it("restores the session after the DB write, for the same user", async () => {
    const { caller, activateUser, restoreSession } = buildCaller("admin");

    await expect(caller.activateUser({ userId: TARGET_ID })).resolves.toEqual({
      success: true,
    });

    expect(activateUser).toHaveBeenCalledWith(TARGET_ID);
    expect(restoreSession).toHaveBeenCalledWith(TARGET_ID);
    const dbOrder = activateUser.mock.invocationCallOrder[0] ?? Infinity;
    const restoreOrder = restoreSession.mock.invocationCallOrder[0] ?? 0;
    expect(dbOrder).toBeLessThan(restoreOrder);
  });

  it("fails loud when restoration is unwired — restoration is never skipped silently", async () => {
    const activateUser = vi.fn().mockResolvedValue({ success: true });
    const snapshotAdminService = Object.assign(
      Object.create(SnapshotAdminService.prototype) as SnapshotAdminService,
      {
        activateUser,
      } satisfies Pick<SnapshotAdminService, "activateUser">,
    );
    const caller = router(
      createAdminUsersProcedures({
        snapshotAdminService,
        sessionRevocationService:
          undefined as unknown as SessionRevocationService,
      }),
    ).createCaller({
      session: makeSession("admin"),
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.activateUser({ userId: TARGET_ID })).rejects.toThrow();
    // The DB activation ran; only the mandatory restoration failed loud.
    expect(activateUser).toHaveBeenCalledWith(TARGET_ID);
  });
});

describe("admin user activation — app-router composition", () => {
  // Pins createAppRouter forwards both services (composition cannot drop
  // the revocation dependency).
  it("createAppRouter wires snapshot + revocation services into deactivateUser", async () => {
    const deactivateUser = vi.fn().mockResolvedValue({ success: true });
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const deps = createStubAppRouterDeps({
      snapshotAdminService: { deactivateUser },
      sessionRevocationService: { revokeSession },
    });

    const caller = createAppRouter(deps).createCaller({
      session: makeSession("admin"),
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(
      caller.admin.deactivateUser({ userId: TARGET_ID }),
    ).resolves.toEqual({ success: true });
    expect(deactivateUser).toHaveBeenCalledWith(TARGET_ID, USER_ID);
    expect(revokeSession).toHaveBeenCalledWith(TARGET_ID);
  });
});
