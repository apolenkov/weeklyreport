import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type OrganizationBrand,
} from "@customreport/shared";

import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import { type RemindersScopeRepository } from "./reminders-scope.types.js";

export interface RemindersRepository extends RemindersScopeRepository {
  getRule(ruleId: string): Promise<AdminReminderRule | null>;
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null>;
  saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution>;
  /**
   * Atomic insert-on-conflict against the `ReminderExecution.dedupeKey` unique
   * index. `inserted` is true only when THIS call created the row; a caller
   * that loses the race gets the existing row with `inserted: false`. The
   * service uses that flag to enqueue the email exactly once, even when two
   * scheduler ticks fire concurrently.
   *
   * Optional on the port because the in-memory test doubles predate it; the
   * production `RemindersPrismaRepository` always provides it, so the dispatch
   * path is atomic in production.
   */
  insertExecutionOnConflict?(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }>;
  /**
   * Atomic `queued → sending` compare-and-set. Returns true only when THIS
   * call wins the transition out of `queued`; a caller that finds it already
   * `sending`/`sent`/`failed` gets false and must send nothing. Enforced in the
   * write itself (a guarded `updateMany`), so a retry or a duplicate worker
   * cannot both claim the same execution.
   *
   * Optional on the port because the in-memory test doubles predate it; the
   * production `RemindersPrismaRepository` always provides it.
   */
  transitionExecutionToSending?(executionId: string): Promise<boolean>;
  /**
   * Terminal `failed` write with an error message, guarded to the non-terminal
   * states so it can never overwrite a row that already reached `sent`.
   * Optional for the same reason as the sibling atomic methods.
   */
  markExecutionFailed?(
    executionId: string,
    errorMessage: string,
  ): Promise<void>;
  getRulePeriodLabel?(ruleId: string): Promise<string | null>;
  /**
   * Reverses the `queued → sending` claim so a retryable send failure can be
   * re-claimed by the next BullMQ attempt instead of being stranded. Guarded
   * to `sending` in the write itself, so it is a no-op against a row that has
   * already reached `sent`/`failed`.
   *
   * Optional on the port because the in-memory test doubles predate it; the
   * production `RemindersPrismaRepository` always provides it.
   */
  releaseExecutionClaim?(executionId: string): Promise<void>;
  /**
   * Atomic `failed → queued` revival; true only when THIS call won the
   * transition (see `reviveFailedExecution` for why it exists). Optional on
   * the port like its sibling CAS methods; production always provides it.
   */
  requeueFailedExecution?(executionId: string): Promise<boolean>;
  getExecution(executionId: string): Promise<AdminReminderExecution | null>;
  /** One DB-level keyset page (newest first) starting strictly after `cursor`. */
  listExecutions(
    ruleId: string,
    page: ExecutionPageRequest,
  ): Promise<AdminReminderExecution[]>;
}

/**
 * One due deadline rule, pre-resolved with the recipient leads whose
 * `ReportSection` for the rule's report is still in `draft`. The scheduler
 * fans out one `kind='deadline'` reminder per recipient; `notificationOptOut`
 * flows through so opted-out leads are skipped (escalation digests ignore it).
 */
export interface DueDeadlineRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  recipients: {
    userId: string;
    email: string;
    name: string;
    notificationOptOut: boolean;
  }[];
}

/**
 * One due escalation rule, fanned out per reporting-group head. Each entry in
 * `groups` becomes exactly one digest email to that head, aggregating only
 * that group's late leads. Resolution is independent of `Report.publishedBy`:
 * escalation fires while leads are still in `draft`, before any publish.
 */
export interface DueEscalationRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  groups: EscalationGroupDigest[];
}

/**
 * The richer payload threaded by the scheduler through
 * `requestReminderExecution`. The dedupeKey uses
 * `${rule.id}:${kind}:${cycleDate}:${recipientEmail}` (see
 * `resolveReminderDedupeKey`) so two scheduler ticks within one UTC day
 * collapse to a single execution for both kinds — a caller that omits
 * `payload` gets the same shape, defaulted to `kind: "deadline"`.
 *
 * Every payload carries `organization` —
 * `{shortName, fullName}` snapshotted at enqueue time from the
 * `Organization` singleton. The worker re-renders the template with that
 * snapshot, so a mid-flight admin edit of the brand strings does NOT
 * affect already-queued emails (one fewer race to debug).
 */
export interface DeadlineReminderPayload {
  kind: "deadline";
  cycleDate: string; // ISO YYYY-MM-DD UTC of the fireAt deadline
  leadName: string;
  reportPeriod: string;
  deadlineIso: string;
  sectionUrl: string;
  organization: OrganizationBrand;
}

export interface EscalationReminderPayload {
  kind: "escalation";
  cycleDate: string; // ISO YYYY-MM-DD UTC of the escalation fireAt
  headName: string;
  reportPeriod: string;
  lateLeads: readonly {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
  organization: OrganizationBrand;
}

export type ReminderExecutionPayload =
  DeadlineReminderPayload | EscalationReminderPayload;
