import type { UserSession } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { RemindersService } from "./reminders.service.js";
import type { RemindersRepository } from "./reminders.types.js";
import { unusedRemindersRepositoryStubs } from "./reminders-scope.repository-stub.js";

const REPORT_ID = "b0000000-0000-4000-a000-0000000000b1";
const RULE_ID = "b0000000-0000-4000-a000-0000000000b2";
const LEAD_ID = "b0000000-0000-4000-a000-0000000000b3";
const SECTION_ID = "b0000000-0000-4000-a000-0000000000b4";

const headSession: UserSession = {
  userId: "b0000000-0000-4000-a000-0000000000b5",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: REPORT_ID,
  activeReportSectionId: null,
};

// An active rule and an in-scope section, so the only gate left to observe is
// the leadId/draft-sections guard itself — not a rule or scope early exit.
function buildService(): RemindersService {
  const repository = {
    ...unusedRemindersRepositoryStubs(),
    findInScopeSectionId: () => Promise.resolve(SECTION_ID),
    findInScopeLeadId: () => Promise.resolve(LEAD_ID),
    findActiveRuleForDispatch: () =>
      Promise.resolve({
        id: RULE_ID,
        fireAt: new Date("2026-04-12T09:00:00.000Z"),
      }),
    findDraftSectionsForDispatch: () => Promise.resolve([]),
  } satisfies RemindersRepository;
  return new RemindersService(repository);
}

describe("RemindersScopeService.dispatchPendingReminders — no-matching-section guard", () => {
  it("a report-wide dispatch with zero draft sections reports a bare zero tally", async () => {
    const result = await buildService().scope.dispatchPendingReminders(
      headSession,
      REPORT_ID,
    );

    // No `reason` key at all: "no-matching-section" belongs to a lead-targeted
    // Remind, and "everyone already submitted" is not a failed dispatch.
    expect(result).toEqual({ dispatched: 0, alreadySent: 0, skipped: 0 });
  });

  it("the same empty draft set targeted at one lead reports no-matching-section", async () => {
    const result = await buildService().scope.dispatchPendingReminders(
      headSession,
      REPORT_ID,
      undefined,
      LEAD_ID,
    );

    expect(result).toEqual({
      dispatched: 0,
      alreadySent: 0,
      skipped: 0,
      reason: "no-matching-section",
    });
  });
});
