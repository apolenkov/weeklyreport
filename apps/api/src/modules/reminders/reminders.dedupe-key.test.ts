import type {
  AdminReminderExecution,
  AdminReminderRule,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { OrganizationService } from "../organization/organization.service.js";
import { RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import {
  buildReminderDedupeKey,
  resolveReminderDedupeKey,
  toReminderCycleDate,
} from "./reminders-dedupe-key.js";
import { unusedRemindersRepositoryStubs } from "./reminders-scope.repository-stub.js";

describe("resolveReminderDedupeKey", () => {
  const rule = {
    id: "66666666-6666-4666-8666-666666666666",
    fireAt: new Date("2026-04-12T09:00:00.000Z"),
  };
  const recipientEmail = "lead1@customreport.local";
  const cycleDate = toReminderCycleDate(rule.fireAt);

  it("uses the explicit discriminator and cycle", () => {
    const key = resolveReminderDedupeKey(rule, recipientEmail, {
      kind: "deadline",
      cycleDate,
    });

    expect(key).toBe(
      buildReminderDedupeKey({
        ruleId: rule.id,
        kind: "deadline",
        cycleDate,
        recipientEmail,
      }),
    );
  });

  it("keeps the canonical key independent from raw timestamp formatting", () => {
    const timestampShape = `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;
    const unifiedShape = resolveReminderDedupeKey(rule, recipientEmail, {
      kind: "deadline",
      cycleDate,
    });

    expect(unifiedShape).not.toBe(timestampShape);
  });
});

// Manual Remind after automated send must report alreadySent, not duplicate.
describe("RemindersScopeService.dispatchDraftSections — manual dispatch after an automated send (regression)", () => {
  const REPORT_ID = "22222222-2222-4222-8222-222222222222";
  const rule: AdminReminderRule = {
    id: "66666666-6666-4666-8666-666666666666",
    reportId: REPORT_ID,
    kind: "deadline",
    fireAt: new Date("2026-04-12T09:00:00.000Z"),
    timezone: "Europe/Moscow",
    status: "active",
    version: 1,
    policyId: null,
  };
  const recipientEmail = "lead1@customreport.local";
  const adminSession: UserSession = {
    userId: "00000000-0000-4000-8000-0000000000ad",
    email: "admin@customreport.local",
    name: "Platform Admin",
    role: "admin",
    activeReportId: REPORT_ID,
    activeReportSectionId: null,
  };

  function buildDispatchRepository(): RemindersRepository {
    const executions = new Map<string, AdminReminderExecution>();

    return {
      ...unusedRemindersRepositoryStubs(),
      getRule(ruleId: string) {
        return Promise.resolve(
          ruleId === rule.id ? structuredClone(rule) : null,
        );
      },
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      findExecutionByDedupeKey(dedupeKey: string) {
        for (const execution of executions.values()) {
          if (execution.dedupeKey === dedupeKey)
            return Promise.resolve(structuredClone(execution));
        }
        return Promise.resolve(null);
      },
      insertExecutionOnConflict(candidate: AdminReminderExecution) {
        for (const existing of executions.values()) {
          if (existing.dedupeKey === candidate.dedupeKey) {
            return Promise.resolve({
              execution: structuredClone(existing),
              inserted: false,
            });
          }
        }
        executions.set(candidate.id, structuredClone(candidate));
        return Promise.resolve({
          execution: structuredClone(candidate),
          inserted: true,
        });
      },
      getExecutionQueuePayload: () =>
        Promise.resolve({
          kind: "deadline" as const,
          cycleDate: toReminderCycleDate(rule.fireAt),
          leadName: "Lead One",
          reportPeriod: "2026-04-07 → 2026-04-13",
          deadlineIso: rule.fireAt.toISOString(),
          sectionUrl:
            "http://localhost:3000/lead/report/22222222-2222-4222-8222-222222222222",
          organization: {
            shortName: "PEO",
            fullName: "Product Engineering & Operations",
          },
        }),
      getExecution(executionId: string) {
        const execution = executions.get(executionId);
        return Promise.resolve(execution ? structuredClone(execution) : null);
      },
      listExecutions(ruleId: string) {
        return Promise.resolve(
          [...executions.values()].filter((e) => e.ruleId === ruleId),
        );
      },
      findActiveRuleForDispatch(reportId: string) {
        return Promise.resolve(
          reportId === rule.reportId
            ? { id: rule.id, fireAt: rule.fireAt }
            : null,
        );
      },
      findDraftSectionsForDispatch() {
        return Promise.resolve([
          {
            email: recipientEmail,
            name: "Lead One",
            notificationOptOut: false,
          },
        ]);
      },
    };
  }

  it("reports alreadySent (not a new dispatch) for a manual Remind following the automated cycle send", async () => {
    const organizationService = {
      getPublic: () =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
    } as OrganizationService;
    const service = new RemindersService(
      buildDispatchRepository(),
      undefined,
      undefined,
      undefined,
      organizationService,
      {
        APP_BASE_URL: "http://localhost:3000",
      },
    );
    const cycleDate = toReminderCycleDate(rule.fireAt);

    // The scheduler's automated T-24h tick.
    await service.requestReminderExecution(rule.id, recipientEmail, {
      kind: "deadline",
      cycleDate,
      leadName: "Lead One",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: rule.fireAt.toISOString(),
      sectionUrl: "http://localhost:3000/lead/report?reportId=x",
      organization: {
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      },
    });

    // Head clicks manual "Remind" for the same rule/lead within the same cycle.
    const result = await service.scope.dispatchPendingReminders(
      adminSession,
      REPORT_ID,
    );

    expect(result.dispatched).toBe(0);
    expect(result.alreadySent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("classifies a fresh insert as dispatched regardless of DB timestamps", async () => {
    const organizationService = {
      getPublic: () =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
    } as OrganizationService;
    const service = new RemindersService(
      buildDispatchRepository(),
      undefined,
      undefined,
      undefined,
      organizationService,
      {
        APP_BASE_URL: "http://localhost:3000",
      },
    );

    const result = await service.scope.dispatchPendingReminders(
      adminSession,
      REPORT_ID,
    );

    expect(result.dispatched).toBe(1);
    expect(result.alreadySent).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
