import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import type {
  SessionRevocationService,
  SnapshotAdminService,
} from "../../../../modules/admin/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { router } from "../../trpc.middleware.js";
import { createAdminUsersProcedures } from "./users.procedures.js";

// Admin-only procedure: the mutation needs an admin session in the context.
const ADMIN_SESSION: UserSession = {
  userId: "10000000-0000-4000-8000-000000000031",
  email: "fixture-admin@example.invalid",
  name: "Fixture Admin",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: "10000000-0000-4000-8000-000000000032",
  reportingGroupName: "Fixture group",
};

const VALID_USER_INPUT = {
  id: "10000000-0000-4000-8000-000000000033",
  email: "fixture-lead@example.invalid",
  role: "lead",
  reportingGroupId: null,
  reportingGroupName: null,
  isActive: true,
  name: "Fixture Lead",
  lastName: "Lead",
  firstName: "Fixture",
  middleName: null,
  position: null,
} as const;

function buildCaller() {
  const upsertUser = vi.fn<SnapshotAdminService["upsertUser"]>();
  const snapshotAdminService = {
    upsertUser,
  } as unknown as SnapshotAdminService;
  const sessionRevocationService = {} as unknown as SessionRevocationService;
  const routes = router(
    createAdminUsersProcedures({
      snapshotAdminService,
      sessionRevocationService,
    }),
  );
  const caller = routes.createCaller({
    session: ADMIN_SESSION,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, upsertUser };
}

describe("admin.users.saveUser safe-text input (W503-08 C2875)", () => {
  it("rejects a whitespace-only firstName with BAD_REQUEST before the service runs", async () => {
    const { caller, upsertUser } = buildCaller();

    await expect(
      caller.saveUser({ ...VALID_USER_INPUT, firstName: " ".repeat(3) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
