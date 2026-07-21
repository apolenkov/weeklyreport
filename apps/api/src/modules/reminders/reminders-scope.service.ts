import type { AdminReminderExecution, UserSession } from "@customreport/shared";

import { ReminderScopeError } from "./reminders.errors.js";
import { resolveReminderDedupeKey } from "./reminders-dedupe-key.js";
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
 * callback rather than an inherited method — the dispatch race-safe
 * read-back calls back into `RemindersService.requestReminderExecution`
 * through it.
 */
export class RemindersScopeService {
  constructor(
    private readonly repository: RemindersScopeRepository,
    private readonly requestReminderExecution: (
      ruleId: string,
      recipientEmail: string,
    ) => Promise<AdminReminderExecution>,
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
   * Race-safe attribution: call `requestReminderExecution` first — it
   * atomically inserts via the dedupeKey unique index, so two concurrent
   * dispatches never produce two emails. Then read the execution back and
   * compare `createdAt` to the call window. If it lies inside the window it
   * is genuinely new, otherwise the service deduplicated against a prior
   * dispatch. A pre-read + call would reintroduce a TOCTOU race where both
   * concurrent callers see "no existing row" and both increment
   * `dispatched`, mis-reporting the counter even though only one email
   * actually went out.
   */
  private async classifySectionDispatch(
    rule: { id: string; fireAt: Date },
    section: { email: string; notificationOptOut: boolean },
  ): Promise<SectionDispatchOutcome> {
    if (section.notificationOptOut) return "skipped";
    // Mirrors the no-payload key `requestReminderExecution` builds for this
    // same rule/recipient below, so the read-back always finds the row
    // this call (or a colliding earlier manual/automated one) produced.
    const dedupeKey = resolveReminderDedupeKey(rule, section.email);
    const beforeMs = Date.now();
    await this.requestReminderExecution(rule.id, section.email);
    const createdAt = await this.repository.findExecutionCreatedAt(dedupeKey);
    return createdAt && createdAt.getTime() >= beforeMs
      ? "dispatched"
      : "alreadySent";
  }

  /**
   * Sequential accumulation, one section at a time: each section's
   * insert-then-read-back must fully resolve before the next one starts, or
   * a fanned-out `Promise.all` could interleave inserts and read-backs across
   * sections and reintroduce the same TOCTOU risk `classifySectionDispatch`
   * exists to avoid.
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
