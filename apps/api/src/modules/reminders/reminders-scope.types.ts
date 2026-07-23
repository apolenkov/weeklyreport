import type { UserSession } from "@customreport/shared";

/** Result of {@link RemindersScopeRepository}-backed `dispatchPendingReminders`. */
export interface DispatchPendingResult {
  dispatched: number;
  alreadySent: number;
  skipped: number;
  reason?: string;
}

/**
 * Scope-authorization + dispatch surface of `RemindersRepository`
 * (`RemindersRepository extends` this).
 */
export interface RemindersScopeRepository {
  /** `ruleId`'s report id, or null when the rule is missing or reportless. */
  getRuleReportId(ruleId: string): Promise<string | null>;
  /** Id of an in-scope `ReportSection` on `reportId`, or null. */
  findInScopeSectionId(
    session: UserSession,
    reportId: string,
  ): Promise<string | null>;
  /** Id of an in-scope DRAFT section on `reportId` authored by `recipientEmail`, or null. */
  findInScopeDraftSectionId(
    session: UserSession,
    reportId: string,
    recipientEmail: string,
  ): Promise<string | null>;
  /** Author emails of every in-scope section on `reportId`. */
  listInScopeSectionAuthorEmails(
    session: UserSession,
    reportId: string,
  ): Promise<string[]>;
  /** Id of an in-scope `User` row for `leadId`, or null. */
  findInScopeLeadId(
    session: UserSession,
    leadId: string,
  ): Promise<string | null>;
  /** The earliest-firing active rule for `reportId` (`fireAt` asc), optionally narrowed to `ruleId`. */
  findActiveRuleForDispatch(
    reportId: string,
    ruleId?: string,
  ): Promise<{ id: string; fireAt: Date } | null>;
  /** In-scope draft sections on `reportId`, optionally narrowed to one lead. */
  findDraftSectionsForDispatch(
    session: UserSession,
    reportId: string,
    leadId?: string,
  ): Promise<{ email: string; notificationOptOut: boolean }[]>;
}
