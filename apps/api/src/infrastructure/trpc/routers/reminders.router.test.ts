import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import type { RemindersService } from "../../../modules/reminders/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createRemindersRouter } from "./reminders.router.js";

const CURRENT_REPORT_ID = "10000000-0000-4000-8000-000000000001";
const STALE_REPORT_ID = "10000000-0000-4000-8000-000000000002";
const OTHER_REPORT_ID = "10000000-0000-4000-8000-000000000003";
const RULE_ID = "10000000-0000-4000-8000-000000000004";

const session: UserSession = {
  userId: "10000000-0000-4000-8000-000000000005",
  email: "head@test.local",
  name: "Test Head",
  role: "head",
  activeReportId: STALE_REPORT_ID,
  activeReportSectionId: null,
};

function buildCaller(currentEditableReportId: string | null) {
  const dispatchPendingReminders = vi.fn().mockResolvedValue({
    queued: 1,
    alreadyRequested: 0,
    failed: 0,
    skipped: 0,
  });
  const remindersService = {
    scope: { dispatchPendingReminders },
  } as unknown as RemindersService;
  const router = createRemindersRouter({
    remindersService,
    weeklyReportService: {
      getCurrentEditableId: vi.fn().mockResolvedValue(currentEditableReportId),
    },
  });
  const caller = router.createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, dispatchPendingReminders };
}

describe("reminders.dispatchPending current editable report gate", () => {
  it("preserves failed and successful enqueue counts in the public response", async () => {
    const { caller, dispatchPendingReminders } = buildCaller(CURRENT_REPORT_ID);
    const outcome = { queued: 1, alreadyRequested: 2, failed: 1, skipped: 3 };
    dispatchPendingReminders.mockResolvedValue(outcome);
    await expect(
      caller.dispatchPending({ reportId: CURRENT_REPORT_ID, ruleId: RULE_ID }),
    ).resolves.toEqual(outcome);
  });

  it("accepts the current DB report despite a stale session claim", async () => {
    const { caller, dispatchPendingReminders } = buildCaller(CURRENT_REPORT_ID);

    await expect(
      caller.dispatchPending({ reportId: CURRENT_REPORT_ID, ruleId: RULE_ID }),
    ).resolves.toEqual({
      queued: 1,
      alreadyRequested: 0,
      failed: 0,
      skipped: 0,
    });
    expect(dispatchPendingReminders).toHaveBeenCalledWith(
      session,
      CURRENT_REPORT_ID,
      RULE_ID,
      undefined,
    );
  });

  it("rejects a report that is not the current editable report", async () => {
    const { caller, dispatchPendingReminders } = buildCaller(CURRENT_REPORT_ID);

    await expect(
      caller.dispatchPending({ reportId: OTHER_REPORT_ID, ruleId: RULE_ID }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "report-not-active",
    });
    expect(dispatchPendingReminders).not.toHaveBeenCalled();
  });

  it("rejects dispatch when no editable report exists", async () => {
    const { caller, dispatchPendingReminders } = buildCaller(null);

    await expect(
      caller.dispatchPending({ reportId: CURRENT_REPORT_ID, ruleId: RULE_ID }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "report-not-active",
    });
    expect(dispatchPendingReminders).not.toHaveBeenCalled();
  });
});
