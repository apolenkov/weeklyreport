import type {
  AdminReminderExecution,
  AdminReminderRule,
} from "@weeklyreport/shared";

import type { EnvConfig } from "../../../infrastructure/config/env.schema";
import type { OrganizationService } from "../../organization/organization.service";
import type { DueDeadlineRule, RemindersRepository } from "../reminders.types";
import { unusedRemindersRepositoryStubs } from "./reminders-scope.repository-stub.js";

// Validated-env fixture for scheduler construction: APP_BASE_URL is resolved
// from the injected EnvConfig at construction, never from raw process.env.
export const schedulerTestEnv = {
  APP_BASE_URL: "https://reports.test.local",
} as EnvConfig;

// Deterministic brand snapshot for payload subject assertions (`[PEO]`).
export const fakeOrganizationService = {
  getPublic: () =>
    Promise.resolve({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    }),
} as unknown as OrganizationService;

export const ruleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const reportId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const reportDeadline = new Date("2026-04-21T09:00:00.000Z");

export const activeRule: AdminReminderRule = {
  id: ruleId,
  reportId,
  kind: "deadline",
  fireAt: new Date("2026-04-19T15:00:00.000Z"),
  timezone: "UTC",
  status: "active",
  version: 1,
  policyId: "99999999-9999-4999-8999-999999999999",
};

export function dueRuleFromRecipients(
  recipients: {
    userId: string;
    email: string;
    name: string;
    notificationOptOut?: boolean;
  }[],
): DueDeadlineRule {
  return {
    id: activeRule.id,
    reportId,
    fireAt: activeRule.fireAt,
    deadline: reportDeadline,
    reportPeriodLabel: "2026-04-13 → 2026-04-19",
    recipients: recipients.map((r) => ({
      ...r,
      notificationOptOut: r.notificationOptOut ?? false,
    })),
  };
}

export function createServiceRepo(
  overrides: Partial<RemindersRepository> = {},
): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    ...unusedRemindersRepositoryStubs(),
    getRule(rid) {
      return Promise.resolve(
        rid === activeRule.id ? structuredClone(activeRule) : null,
      );
    },
    findExecutionByDedupeKey(dedupeKey) {
      for (const exec of executions.values()) {
        if (exec.dedupeKey === dedupeKey) {
          return Promise.resolve(structuredClone(exec));
        }
      }
      return Promise.resolve(null);
    },
    insertExecutionOnConflict(execution) {
      for (const exec of executions.values()) {
        if (exec.dedupeKey === execution.dedupeKey) {
          return Promise.resolve({
            execution: structuredClone(exec),
            outcome: "deduplicated" as const,
          });
        }
      }
      executions.set(execution.id, structuredClone(execution));
      return Promise.resolve({
        execution: structuredClone(execution),
        outcome: "created" as const,
      });
    },
    getExecution(id) {
      return Promise.resolve(executions.get(id) ?? null);
    },
    listExecutions(rid) {
      return Promise.resolve(
        [...executions.values()].filter((e) => e.ruleId === rid),
      );
    },
    ...overrides,
  };
}
