import type { AdminReminderExecution } from "@customreport/shared";
import { vi } from "vitest";

import type { RemindersRepository } from "./reminders.types.js";

/**
 * A complete inert `RemindersRepository` for unit tests. Test doubles spread
 * this object and override only the behavior under test, while still
 * implementing every required production capability.
 */
export function unusedRemindersRepositoryStubs(): RemindersRepository {
  return {
    getRule: vi.fn().mockResolvedValue(null),
    getRulePeriodLabel: vi.fn().mockResolvedValue(null),
    findExecutionByDedupeKey: vi.fn().mockResolvedValue(null),
    saveExecution: vi.fn((execution: AdminReminderExecution) =>
      Promise.resolve(execution),
    ),
    insertExecutionOnConflict: vi.fn((execution: AdminReminderExecution) =>
      Promise.resolve({ execution, inserted: true }),
    ),
    transitionExecutionToSending: vi.fn().mockResolvedValue(false),
    markExecutionFailed: vi.fn().mockResolvedValue(undefined),
    releaseExecutionClaim: vi.fn().mockResolvedValue(undefined),
    requeueFailedExecution: vi.fn().mockResolvedValue(false),
    getExecution: vi.fn().mockResolvedValue(null),
    listExecutions: vi.fn().mockResolvedValue([]),
    getRuleReportId: vi.fn().mockResolvedValue(null),
    findInScopeSectionId: vi.fn().mockResolvedValue(null),
    findInScopeDraftSectionId: vi.fn().mockResolvedValue(null),
    listInScopeSectionAuthorEmails: vi.fn().mockResolvedValue([]),
    findInScopeLeadId: vi.fn().mockResolvedValue(null),
    findActiveRuleForDispatch: vi.fn().mockResolvedValue(null),
    findDraftSectionsForDispatch: vi.fn().mockResolvedValue([]),
  };
}
