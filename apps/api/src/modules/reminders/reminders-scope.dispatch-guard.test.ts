import {
  adminReminderExecutionSchema,
  type UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import type { OrganizationService } from "../organization/organization.service.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { RemindersService } from "./reminders.service.js";
import type { RemindersRepository } from "./reminders.types.js";
import { RemindersScopeService } from "./reminders-scope.service.js";

const REPORT_ID = "b0000000-0000-4000-a000-0000000000b1";
const RULE_ID = "b0000000-0000-4000-a000-0000000000b2";
const LEAD_ID = "b0000000-0000-4000-a000-0000000000b3";
const SECTION_ID = "b0000000-0000-4000-a000-0000000000b4";

const headSession: UserSession = {
  userId: "b0000000-0000-4000-a000-0000000000b5",
  email: "head@weeklyreport.local",
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
        deadline: new Date("2026-04-13T18:00:00.000Z"),
      }),
    findDraftSectionsForDispatch: () => Promise.resolve([]),
  } satisfies RemindersRepository;
  const organizationService = {
    getPublic: () =>
      Promise.resolve({
        shortName: "Demo",
        fullName: "Example Software Department",
      }),
  } as OrganizationService;
  return new RemindersService(
    repository,
    createNullLogger(),
    undefined,
    undefined,
    organizationService,
    {
      APP_BASE_URL: "http://localhost:3000",
    },
  );
}

describe("RemindersScopeService.dispatchPendingReminders — no-matching-section guard", () => {
  it("a report-wide dispatch with zero draft sections reports a bare zero tally", async () => {
    const result = await buildService().scope.dispatchPendingReminders(
      headSession,
      REPORT_ID,
      RULE_ID,
    );

    // No `reason` key at all: "no-matching-section" belongs to a lead-targeted
    // Remind, and "everyone already submitted" is not a failed dispatch.
    expect(result).toEqual({
      queued: 0,
      alreadyRequested: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it("the same empty draft set targeted at one lead reports no-matching-section", async () => {
    const result = await buildService().scope.dispatchPendingReminders(
      headSession,
      REPORT_ID,
      RULE_ID,
      LEAD_ID,
    );

    expect(result).toEqual({
      queued: 0,
      alreadyRequested: 0,
      failed: 0,
      skipped: 0,
      reason: "no-matching-section",
    });
  });

  it("classifies a deep recipient set in one flat pass — no recursion, no per-recipient acc copies", async () => {
    const COUNT = 100_000;
    const sections = Array.from({ length: COUNT }, (_, index) => ({
      email: `lead-${index}@test.local`,
      name: `Lead ${index}`,
      notificationOptOut: false,
    }));
    const repository = {
      ...unusedRemindersRepositoryStubs(),
      findInScopeSectionId: () => Promise.resolve(SECTION_ID),
      findActiveRuleForDispatch: () =>
        Promise.resolve({
          id: RULE_ID,
          fireAt: new Date("2026-04-12T09:00:00.000Z"),
          deadline: new Date("2026-04-13T18:00:00.000Z"),
        }),
      findDraftSectionsForDispatch: () => Promise.resolve(sections),
    } satisfies RemindersRepository;
    const service = new RemindersScopeService(
      repository,
      () =>
        Promise.resolve({
          execution: adminReminderExecutionSchema.parse({
            id: SECTION_ID,
            ruleId: RULE_ID,
            reportId: REPORT_ID,
            dedupeKey: "fixture",
            status: "queued",
            scheduledFor: new Date("2026-04-12T09:00:00.000Z"),
            sentAt: null,
            recipientEmail: "lead@test.local",
            errorMessage: null,
          }),
          outcome: "created",
        }),
      createNullLogger(),
    );

    // The dispatch fold keeps memory and work linear in the recipient count.
    const result = await service.dispatchPendingReminders(
      headSession,
      REPORT_ID,
      RULE_ID,
    );

    expect(result.queued).toBe(COUNT);
    expect(result.alreadyRequested).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
