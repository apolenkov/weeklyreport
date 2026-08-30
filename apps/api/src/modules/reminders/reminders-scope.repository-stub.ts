import type { AdminReminderExecution } from "@customreport/shared";
import { vi } from "vitest";

import type { RemindersRepository } from "./reminders.types.js";

// Inert full repository; tests spread and override only the methods under test.
export function unusedRemindersRepositoryStubs(): RemindersRepository {
  return {
    getRule: vi.fn().mockResolvedValue(null),
    getRulePeriodLabel: vi.fn().mockResolvedValue(null),
    findExecutionByDedupeKey: vi.fn().mockResolvedValue(null),
    markExecutionSent: vi.fn().mockResolvedValue(null),
    insertExecutionOnConflict: vi.fn((execution: AdminReminderExecution) =>
      Promise.resolve({ execution, inserted: true }),
    ),
    transitionExecutionToSending: vi.fn().mockResolvedValue(false),
    markExecutionFailed: vi.fn().mockResolvedValue(undefined),
    releaseExecutionClaim: vi.fn().mockResolvedValue(undefined),
    requeueFailedExecution: vi.fn().mockResolvedValue(false),
    markStuckSendingSent: vi.fn().mockResolvedValue(0),
    getExecution: vi.fn().mockResolvedValue(null),
    getExecutionQueuePayload: vi.fn().mockResolvedValue(null),
    listExecutions: vi.fn().mockResolvedValue([]),
    getRuleReportId: vi.fn().mockResolvedValue(null),
    findInScopeSectionId: vi.fn().mockResolvedValue(null),
    listInScopeSectionAuthorEmails: vi.fn().mockResolvedValue([]),
    findInScopeLeadId: vi.fn().mockResolvedValue(null),
    findActiveRuleForDispatch: vi.fn().mockResolvedValue(null),
    findDraftSectionsForDispatch: vi.fn().mockResolvedValue([]),
  };
}
