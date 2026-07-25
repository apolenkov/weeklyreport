import type { UserSession } from "@customreport/shared";

export interface DispatchPendingResult {
  dispatched: number;
  alreadySent: number;
  skipped: number;
  reason?: string;
}

export interface RemindersScopeRepository {
  getRuleReportId(ruleId: string): Promise<string | null>;
  findInScopeSectionId(
    session: UserSession,
    reportId: string,
  ): Promise<string | null>;
  findInScopeDraftSectionId(
    session: UserSession,
    reportId: string,
    recipientEmail: string,
  ): Promise<string | null>;
  listInScopeSectionAuthorEmails(
    session: UserSession,
    reportId: string,
  ): Promise<string[]>;
  findInScopeLeadId(
    session: UserSession,
    leadId: string,
  ): Promise<string | null>;
  findActiveRuleForDispatch(
    reportId: string,
    ruleId?: string,
  ): Promise<{ id: string; fireAt: Date } | null>;
  findDraftSectionsForDispatch(
    session: UserSession,
    reportId: string,
    leadId?: string,
  ): Promise<{ email: string; notificationOptOut: boolean }[]>;
}
