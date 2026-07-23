import type { AdminReminderExecution, UserSession } from "@customreport/shared";

import { ReminderScopeError } from "./reminders.errors.js";
import type {
  DispatchPendingResult,
  RemindersScopeRepository,
} from "./reminders-scope.types.js";

const REMINDER_RULE_OUT_OF_SCOPE_MESSAGE = "reminder-rule-out-of-scope";

/** Per-section result of {@link RemindersScopeService.classifySectionDispatch}. */
type SectionDispatchOutcome = "alreadySent" | "dispatched" | "skipped";

/** Pure tally: turns per-section outcomes into the public dispatch counters. */
function tallyDispatchOutcomes(
  outcomes: readonly SectionDispatchOutcome[],
): Pick<DispatchPendingResult, "alreadySent" | "dispatched" | "skipped"> {
  return {
    dispatched: outcomes.filter((outcome) => outcome === "dispatched").length,
    alreadySent: outcomes.filter((outcome) => outcome === "alreadySent").length,
    skipped: outcomes.filter((outcome) => outcome === "skipped").length,
  };
}

/** The zero-activity result shape shared by `dispatchPendingReminders`'s two early-exit paths. */
function noDispatchResult(reason: string): DispatchPendingResult {
  return { dispatched: 0, alreadySent: 0, skipped: 0, reason };
}

/**
 * Scope-authorization + dispatch logic for the reminders namespace, split out
 * of `RemindersService` (which holds one as a private field) to keep that
 * file under the line budget. `requestReminderExecution` is threaded in as a
 * callback rather than an inherited method; it returns the atomic dispatch
 * outcome the insert itself proved, which is what counters classify on.
 */
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

  /**
   * A reminder rule's only group link is `rule.report -> section.author
   * group`. Resolve the rule's report id, rejecting a missing rule or a rule
   * with no report — a non-admin caller cannot be scoped against it, so it
   * is out of reach (FORBIDDEN, fail-closed).
   */
  private async resolveScopedReportId(ruleId: string): Promise<string> {
    const reportId = await this.repository.getRuleReportId(ruleId);
    if (!reportId) {
      throw new ReminderScopeError(REMINDER_RULE_OUT_OF_SCOPE_MESSAGE);
    }
    return reportId;
  }

  /**
   * The rule is in scope iff its report carries at least one section whose
   * author is in the caller's group.
   */
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

  /**
   * The recipient of a manual execution must be an in-scope draft-section
   * author on the rule's report — not an arbitrary address (closes the
   * open-mailer hole).
   */
  private async assertDraftRecipientInScope(
    session: UserSession,
    reportId: string,
    recipientEmail: string,
  ): Promise<void> {
    const sectionId = await this.repository.findInScopeDraftSectionId(
      session,
      reportId,
      recipientEmail,
    );
    if (!sectionId) {
      throw new ReminderScopeError("reminder-recipient-out-of-scope");
    }
  }

  /**
   * A single-lead dispatch is authorized against the `User` row, not a
   * section — an in-scope lead may have no section yet, which a section
   * check could not distinguish from an out-of-scope lead. Admin's empty
   * scope fragment matches any user (god-mode).
   */
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

  /**
   * Authorization for `reminders.execute`: admin bypasses; a non-admin
   * caller must own the rule's report scope AND the recipient must be an
   * in-scope draft-section author.
   */
  async authorizeExecute(
    session: UserSession,
    ruleId: string,
    recipientEmail: string,
  ): Promise<void> {
    if (session.role === "admin") return;
    const reportId = await this.resolveScopedReportId(ruleId);
    await this.assertReportHasInScopeSection(session, reportId);
    await this.assertDraftRecipientInScope(session, reportId, recipientEmail);
  }

  /**
   * The recipient-email allowlist for `reminders.listExecutions`: null for
   * admin (unfiltered), otherwise every in-scope section author on the
   * rule's report plus the caller's own email (escalation digests are
   * addressed to the head themself). Rejects a rule whose report has no
   * in-scope section (out of reach).
   */
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

  /**
   * Authorization + dispatch for `reminders.dispatchPending`. An
   * out-of-scope report fails closed BEFORE any rule is resolved, so the
   * response cannot reveal whether a rule exists there (no rule-existence
   * oracle). A single-lead dispatch is authorized against the lead's `User`
   * row, not a section, preserving the no-section success state for an
   * in-scope lead with no draft yet.
   */
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

  /**
   * Race-safe attribution straight from the atomic insert: the dedupeKey
   * unique index means exactly one caller ever gets "created" (and a revived
   * failed row also produces a real send), so counters classify on the
   * outcome the write itself proved — no clocks involved.
   */
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

  /**
   * Sequential accumulation, one section at a time, so dispatch side effects
   * (enqueue, revive) and their outcomes resolve in a deterministic order
   * instead of interleaving across sections under a fanned-out Promise.all.
   */
  private async collectDispatchOutcomes(
    rule: { id: string; fireAt: Date },
    remaining: readonly { email: string; notificationOptOut: boolean }[],
    acc: readonly SectionDispatchOutcome[],
  ): Promise<readonly SectionDispatchOutcome[]> {
    const [section, ...rest] = remaining;
    if (!section) return acc;
    const outcome = await this.classifySectionDispatch(rule, section);
    return this.collectDispatchOutcomes(rule, rest, [...acc, outcome]);
  }

  private async dispatchDraftSections(
    rule: { id: string; fireAt: Date },
    draftSections: { email: string; notificationOptOut: boolean }[],
  ): Promise<DispatchPendingResult> {
    const outcomes = await this.collectDispatchOutcomes(
      rule,
      draftSections,
      [],
    );
    return tallyDispatchOutcomes(outcomes);
  }
}
