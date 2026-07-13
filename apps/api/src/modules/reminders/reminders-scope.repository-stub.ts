import { vi } from "vitest";

import type { RemindersScopeRepository } from "./reminders-scope.service.js";

/**
 * The 8 scope-authorization/dispatch methods of `RemindersRepository`,
 * stubbed to their "nothing in scope" / "nothing to dispatch" result. None of
 * the pre-existing reminders unit-test fakes exercise these paths (they
 * predate the reminders.dispatchPending / scope-authorization slice); spread
 * this into a fake's object literal so it satisfies the (now required)
 * `RemindersRepository` port without every call site hand-rolling all 8.
 */
export function unusedRemindersScopeStubs(): RemindersScopeRepository {
  return {
    getRuleReportId: vi.fn().mockResolvedValue(null),
    findInScopeSectionId: vi.fn().mockResolvedValue(null),
    findInScopeDraftSectionId: vi.fn().mockResolvedValue(null),
    listInScopeSectionAuthorEmails: vi.fn().mockResolvedValue([]),
    findInScopeLeadId: vi.fn().mockResolvedValue(null),
    findActiveRuleForDispatch: vi.fn().mockResolvedValue(null),
    findDraftSectionsForDispatch: vi.fn().mockResolvedValue([]),
    findExecutionCreatedAt: vi.fn().mockResolvedValue(null),
  };
}
