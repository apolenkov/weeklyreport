import type { UserSession } from "@customreport/shared";

export interface RemindersScopeRepository {
  readonly getRuleReportId: (ruleId: string) => Promise<string | null>;
  readonly findInScopeSectionId: (
    session: UserSession,
    reportId: string,
  ) => Promise<string | null>;
  readonly listInScopeSectionAuthorEmails: (
    session: UserSession,
    reportId: string,
  ) => Promise<readonly string[]>;
  readonly findInScopeLeadId: (
    session: UserSession,
    leadId: string,
  ) => Promise<string | null>;
  readonly findActiveRuleForDispatch: (
    reportId: string,
    ruleId: string,
  ) => Promise<{
    readonly id: string;
    readonly fireAt: Date;
    readonly deadline: Date;
  } | null>;
  readonly findDraftSectionsForDispatch: (
    session: UserSession,
    reportId: string,
    leadId?: string,
  ) => Promise<
    readonly {
      readonly email: string;
      readonly name?: string;
      readonly notificationOptOut: boolean;
    }[]
  >;
}
