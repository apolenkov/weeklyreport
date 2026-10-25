import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import type {
  PeriodAdminService,
  ReopenRequestAdminService,
} from "../../../../modules/admin/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { router } from "../../trpc.middleware.js";
import { createAdminPeriodsProcedures } from "./periods.procedures.js";

// Admin-only procedure: even the read needs an admin session in the context.
const ADMIN_SESSION: UserSession = {
  userId: "10000000-0000-4000-8000-000000000021",
  email: "fixture-admin@example.invalid",
  name: "Fixture Admin",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: "10000000-0000-4000-8000-000000000022",
  reportingGroupName: "Fixture group",
};

const CURSOR_ID = "10000000-0000-4000-8000-000000000023";
const VALID_CURSOR = {
  periodStart: new Date("2026-04-01T00:00:00.000Z"),
  id: CURSOR_ID,
} as const;

function buildCaller() {
  const listPeriodsByState = vi
    .fn<PeriodAdminService["listPeriodsByState"]>()
    .mockResolvedValue({ periods: [], nextCursor: null });
  const periodAdminService = {
    listPeriodsByState,
  } as unknown as PeriodAdminService;
  const reopenRequestAdminService = {} as unknown as ReopenRequestAdminService;
  const routes = router(
    createAdminPeriodsProcedures({
      periodAdminService,
      reopenRequestAdminService,
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
  return { caller, listPeriodsByState };
}

describe("admin.listPeriodsByState cursor contract (C0455)", () => {
  it("passes a valid keyset cursor through to the domain service", async () => {
    const { caller, listPeriodsByState } = buildCaller();

    await expect(
      caller.listPeriodsByState({
        bucket: "archive",
        cursor: VALID_CURSOR,
        limit: 50,
      }),
    ).resolves.toEqual({ periods: [], nextCursor: null });
    expect(listPeriodsByState).toHaveBeenCalledExactlyOnceWith({
      bucket: "archive",
      cursor: VALID_CURSOR,
      limit: 50,
    });
  });

  it.each([
    ["a garbage date", { periodStart: "not-a-date", id: CURSOR_ID }],
    [
      "a non-uuid id",
      { periodStart: VALID_CURSOR.periodStart, id: "not-a-uuid" },
    ],
    // z.coerce.date() alone turns null into the epoch; a cursor must be a real row.
    ["a null periodStart", { periodStart: null, id: CURSOR_ID }],
  ])(
    "rejects %s as BAD_REQUEST before the domain call",
    async (_label, cursor) => {
      const { caller, listPeriodsByState } = buildCaller();

      await expect(
        caller.listPeriodsByState({
          bucket: "archive",
          cursor: cursor as never,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(listPeriodsByState).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["an ISO timestamp", "2026-04-01T00:00:00.000Z"],
    ["a date-only value", "2026-10-25"],
  ])(
    "normalizes %s cursor to a Date before the domain call",
    async (_label, periodStart) => {
      const { caller, listPeriodsByState } = buildCaller();

      await caller.listPeriodsByState({
        bucket: "archive",
        cursor: { periodStart, id: CURSOR_ID },
      });

      const call = listPeriodsByState.mock.calls[0]?.[0];
      expect(call?.cursor?.periodStart).toBeInstanceOf(Date);
      expect(call?.cursor?.periodStart).toEqual(new Date(periodStart));
    },
  );

  it("rejects a null cursor as BAD_REQUEST", async () => {
    const { caller, listPeriodsByState } = buildCaller();

    await expect(
      caller.listPeriodsByState({ bucket: "archive", cursor: null } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeriodsByState).not.toHaveBeenCalled();
  });

  it('rejects a limit above 200 before the domain call ("The limit is bounded")', async () => {
    const { caller, listPeriodsByState } = buildCaller();

    await expect(
      caller.listPeriodsByState({ bucket: "archive", limit: 201 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeriodsByState).not.toHaveBeenCalled();
  });
});
