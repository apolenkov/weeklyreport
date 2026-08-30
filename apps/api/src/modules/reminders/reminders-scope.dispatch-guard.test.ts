import type { AdminReminderRule, UserSession } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { OrganizationService } from "../organization/organization.service.js";
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
  const organizationService = {
    getPublic: () =>
      Promise.resolve({
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      }),
  } as OrganizationService;
  return new RemindersService(
    repository,
    undefined,
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

  it("classifies a deep recipient set in one flat pass — no recursion, no per-recipient acc copies", async () => {
    const COUNT = 100_000;
    const sections = Array.from({ length: COUNT }, (_, index) => ({
      email: `lead-${index}@test.local`,
      name: `Lead ${index}`,
      notificationOptOut: false,
    }));
    const activeRule: AdminReminderRule = {
      id: RULE_ID,
      reportId: REPORT_ID,
      kind: "deadline",
      fireAt: new Date("2026-04-12T09:00:00.000Z"),
      timezone: "Europe/Moscow",
      status: "active",
      version: 1,
      policyId: null,
    };
    const repository = {
      ...unusedRemindersRepositoryStubs(),
      getRule: () => Promise.resolve(activeRule),
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      findInScopeSectionId: () => Promise.resolve(SECTION_ID),
      findActiveRuleForDispatch: () =>
        Promise.resolve({ id: RULE_ID, fireAt: activeRule.fireAt }),
      findDraftSectionsForDispatch: () => Promise.resolve(sections),
    } satisfies RemindersRepository;
    const organizationService = {
      getPublic: () =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
    } as OrganizationService;
    const service = new RemindersService(
      repository,
      undefined,
      undefined,
      undefined,
      organizationService,
      {
        APP_BASE_URL: "http://localhost:3000",
      },
    );

    // The old per-recipient `rest`/`acc` copies are O(n²) — 100k recipients
    // takes ~20s there (over vitest's 5s default) and ~0.25s with the loop.
    const result = await service.scope.dispatchPendingReminders(
      headSession,
      REPORT_ID,
    );

    expect(result.dispatched).toBe(COUNT);
    expect(result.alreadySent).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
