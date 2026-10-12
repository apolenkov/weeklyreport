import type {
  AdminReminderExecution,
  AdminReminderRule,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger";
import type { OrganizationService } from "../organization/organization.service.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import {
  buildReminderDedupeKey,
  resolveReminderDedupeKey,
  toReminderCycleDate,
} from "./reminders-dedupe-key.js";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";

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

// Manual Remind after automated send must report alreadyRequested, not duplicate.
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
    policyId: "99999999-9999-4999-8999-999999999999",
  };
  const reportDeadline = new Date("2026-04-13T18:00:00.000Z");
  const recipientEmail = "lead1@customreport.local";
  const adminSession: UserSession = {
    userId: "00000000-0000-4000-8000-0000000000ad",
    email: "admin@customreport.local",
    name: "Platform Admin",
    role: "admin",
    activeReportId: REPORT_ID,
    activeReportSectionId: null,
  };

  function buildDispatchRepository(
    insertedPayloads: ReminderQueuePayload[] = [],
  ): RemindersRepository {
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
      insertExecutionOnConflict(
        candidate: AdminReminderExecution,
        payload: ReminderQueuePayload,
      ) {
        for (const existing of executions.values()) {
          if (existing.dedupeKey === candidate.dedupeKey) {
            return Promise.resolve({
              execution: structuredClone(existing),
              outcome: "deduplicated" as const,
            });
          }
        }
        insertedPayloads.push(structuredClone(payload));
        executions.set(candidate.id, structuredClone(candidate));
        return Promise.resolve({
          execution: structuredClone(candidate),
          outcome: "created" as const,
        });
      },
      getExecutionQueuePayload: () =>
        Promise.resolve({
          contractVersion: 1 as const,
          kind: "deadline" as const,
          cycleDate: toReminderCycleDate(rule.fireAt),
          leadName: "Lead One",
          reportPeriod: "2026-04-07 → 2026-04-13",
          deadlineIso: reportDeadline.toISOString(),
          sectionUrl:
            "http://localhost:3000/lead/report/22222222-2222-4222-8222-222222222222",
          organization: {
            shortName: "Demo",
            fullName: "Example Software Department",
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
      findActiveRuleForDispatch(reportId: string, ruleId: string) {
        return Promise.resolve(
          reportId === rule.reportId && ruleId === rule.id
            ? {
                id: rule.id,
                fireAt: rule.fireAt,
                deadline: reportDeadline,
              }
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

  it("reports alreadyRequested (not a new dispatch) for a manual Remind following the automated cycle send", async () => {
    const organizationService = {
      getPublic: () =>
        Promise.resolve({
          shortName: "Demo",
          fullName: "Example Software Department",
        }),
    } as OrganizationService;
    const service = new RemindersService(
      buildDispatchRepository(),
      createNullLogger(),
      undefined,
      undefined,
      organizationService,
      {
        APP_BASE_URL: "http://localhost:3000",
      },
    );
    const cycleDate = toReminderCycleDate(rule.fireAt);

    // The scheduler's automated policy-relative tick.
    await service.requestReminderExecution(rule.id, recipientEmail, {
      kind: "deadline",
      cycleDate,
      leadName: "Lead One",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: reportDeadline.toISOString(),
      sectionUrl: "http://localhost:3000/lead/report?reportId=x",
      organization: {
        shortName: "Demo",
        fullName: "Example Software Department",
      },
    });

    // Head clicks manual "Remind" for the same rule/lead within the same cycle.
    const result = await service.scope.dispatchPendingReminders(
      adminSession,
      REPORT_ID,
      rule.id,
    );

    expect(result.queued).toBe(0);
    expect(result.alreadyRequested).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("classifies a fresh insert as queued regardless of DB timestamps", async () => {
    const insertedPayloads: ReminderQueuePayload[] = [];
    const organizationService = {
      getPublic: () =>
        Promise.resolve({
          shortName: "Demo",
          fullName: "Example Software Department",
        }),
    } as OrganizationService;
    const service = new RemindersService(
      buildDispatchRepository(insertedPayloads),
      createNullLogger(),
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
      rule.id,
    );

    expect(result.queued).toBe(1);
    expect(result.alreadyRequested).toBe(0);
    expect(result.skipped).toBe(0);
    const insertedPayload = insertedPayloads[0];
    if (insertedPayload?.kind !== "deadline") {
      throw new Error("expected a persisted deadline payload");
    }
    expect(insertedPayload.deadlineIso).toBe(reportDeadline.toISOString());
    expect(insertedPayload.deadlineIso).not.toBe(rule.fireAt.toISOString());
  });
});
