import type { AdminReminderExecution, UserSession } from "@customreport/shared";

import { ReminderScopeError } from "./reminders.errors.js";
import type {
  DispatchPendingResult,
  RemindersScopeRepository,
} from "./reminders-scope.types.js";

const REMINDER_RULE_OUT_OF_SCOPE_MESSAGE = "reminder-rule-out-of-scope";

type SectionDispatchOutcome = "alreadySent" | "dispatched" | "skipped";

function tallyDispatchOutcomes(
  outcomes: readonly SectionDispatchOutcome[],
): Pick<DispatchPendingResult, "alreadySent" | "dispatched" | "skipped"> {
  return {
    dispatched: outcomes.filter((outcome) => outcome === "dispatched").length,
    alreadySent: outcomes.filter((outcome) => outcome === "alreadySent").length,
    skipped: outcomes.filter((outcome) => outcome === "skipped").length,
  };
}

function noDispatchResult(reason: string): DispatchPendingResult {
  return { dispatched: 0, alreadySent: 0, skipped: 0, reason };
}

// Scope-authorization + dispatch for the reminders namespace. requestReminderExecution
// is a callback so counters classify on the atomic insert outcome.
export class RemindersScopeService {
  constructor(
    private readonly repository: RemindersScopeRepository,
    private readonly requestReminderExecution: (
      ruleId: string,
      recipientEmail: string,
    ) => Promise<{
      execution: AdminReminderExecution;
      outcome: "created" | "revived" | "deduplicated";
    }>,
  ) {}

  // Fail closed: missing/reportless rule is out of reach for non-admin.
  private async resolveScopedReportId(ruleId: string): Promise<string> {
    const reportId = await this.repository.getRuleReportId(ruleId);
    if (!reportId) {
      throw new ReminderScopeError(REMINDER_RULE_OUT_OF_SCOPE_MESSAGE);
    }
    return reportId;
  }

  private async assertReportHasInScopeSection(
    session: UserSession,
    reportId: string,
  ): Promise<void> {
    const sectionId = await this.repository.findInScopeSectionId(
      session,
      reportId,
    );
    if (!sectionId) {
      throw new ReminderScopeError(REMINDER_RULE_OUT_OF_SCOPE_MESSAGE);
    }
  }

  // Authorize against the User row: in-scope lead may have no section yet.
  private async assertLeadInScope(
    session: UserSession,
    leadId: string,
  ): Promise<void> {
    const scopedLeadId = await this.repository.findInScopeLeadId(
      session,
      leadId,
    );
    if (!scopedLeadId) {
      throw new ReminderScopeError("lead-out-of-scope");
    }
  }

  // Admin: unfiltered. Else in-scope authors + caller's email (escalation digests).
  async resolveExecutionsRecipientAllowlist(
    session: UserSession,
    ruleId: string,
  ): Promise<ReadonlySet<string> | null> {
    if (session.role === "admin") return null;
    const reportId = await this.resolveScopedReportId(ruleId);
    const emails = await this.repository.listInScopeSectionAuthorEmails(
      session,
      reportId,
    );
    if (emails.length === 0) {
      throw new ReminderScopeError(REMINDER_RULE_OUT_OF_SCOPE_MESSAGE);
    }
    return new Set([...emails, session.email]);
  }

  // Fail closed on scope before rule resolution (no rule-existence oracle).
  async dispatchPendingReminders(
    session: UserSession,
    reportId: string,
    ruleId?: string,
    leadId?: string,
  ): Promise<DispatchPendingResult> {
    if (session.role !== "admin") {
      await this.assertReportHasInScopeSection(session, reportId);
    }
    if (leadId !== undefined) {
      await this.assertLeadInScope(session, leadId);
    }
    const rule = await this.repository.findActiveRuleForDispatch(
      reportId,
      ruleId,
    );
    if (!rule) return noDispatchResult("no-active-rule");
    const draftSections = await this.repository.findDraftSectionsForDispatch(
      session,
      reportId,
      leadId,
    );
    if (leadId !== undefined && draftSections.length === 0)
      return noDispatchResult("no-matching-section");
    return this.dispatchDraftSections(rule, draftSections);
  }

  // Classify from the atomic insert outcome (dedupeKey unique index); no clocks.
  private async classifySectionDispatch(
    rule: { id: string; fireAt: Date },
    section: { email: string; notificationOptOut: boolean },
  ): Promise<SectionDispatchOutcome> {
    if (section.notificationOptOut) return "skipped";
    const { outcome } = await this.requestReminderExecution(
      rule.id,
      section.email,
    );
    return outcome === "deduplicated" ? "alreadySent" : "dispatched";
  }

  // Sequential so enqueue/revive outcomes resolve in deterministic order; the
  // loop (not recursion, not per-step acc copies) keeps a deep recipient set
  // flat — one await per section, O(n) memory.
  private async dispatchDraftSections(
    rule: { id: string; fireAt: Date },
    draftSections: readonly {
      email: string;
      notificationOptOut: boolean;
    }[],
  ): Promise<DispatchPendingResult> {
    const outcomes: SectionDispatchOutcome[] = [];
    for (const section of draftSections) {
      outcomes.push(await this.classifySectionDispatch(rule, section));
    }
    return tallyDispatchOutcomes(outcomes);
  }
}
