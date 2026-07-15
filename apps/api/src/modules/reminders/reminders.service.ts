import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  type OrganizationBrand,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";
import type { ClsService } from "nestjs-cls";

import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { ReminderDomainError, ReminderScopeError } from "./reminders.errors.js";
import {
  type EnqueueContext,
  enqueueOrMarkFailed,
  reEnqueueStuck,
} from "./reminders-enqueue.js";
import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";
import {
  type ExecutionPageRequest,
  paginateReminderExecutions,
} from "./reminders-execution-pagination.js";
import { requireRulePeriodLabel } from "./reminders-queue-payload.js";
import {
  type RemindersScopeRepository,
  RemindersScopeService,
} from "./reminders-scope.service.js";

export { ReminderDomainError, ReminderScopeError };

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
 * `${rule.id}:${kind}:${cycleDate}:${recipientEmail}` so two scheduler ticks
 * within one UTC day collapse to a single execution for both kinds.
 *
 * The legacy dedupe key shape
 * (`${rule.id}:${fireAt.toISOString()}:${recipientEmail}`) is preserved for
 * callers that omit `payload`.
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
  | DeadlineReminderPayload
  | EscalationReminderPayload;

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: JobEnqueuer | null;
  /**
   * Scope-authorization + dispatch surface for the reminders.* procedures
   * (see `RemindersScopeService`). Composed, not inherited, so the router
   * calls `remindersService.scope.authorizeExecute(...)` etc. directly.
   */
  readonly scope: RemindersScopeService;

  constructor(
    private readonly repository: RemindersRepository,
    logger?: AppLogger,
    emailQueue?: JobEnqueuer,
    private readonly cls?: ClsService,
  ) {
    this.logger = logger ?? createNullLogger();
    this.emailQueue = emailQueue ?? null;
    this.scope = new RemindersScopeService(repository, (ruleId, email) =>
      this.requestReminderExecution(ruleId, email),
    );
  }

  /**
   * Record (idempotently) and enqueue one reminder execution. With a `payload`
   * the dedupe key is `${rule.id}:${kind}:${cycleDate}:${recipientEmail}`, so
   * hourly ticks within one UTC cycle collapse to a single execution; without
   * one it keeps the legacy ISO-suffixed shape. The email job is enqueued only
   * when this call actually inserted the row, so a concurrent duplicate tick
   * enqueues nothing.
   */
  async requestReminderExecution(
    ruleId: string,
    recipientEmail: string,
    payload?: ReminderExecutionPayload,
  ): Promise<AdminReminderExecution> {
    const rule = await this.repository.getRule(ruleId);

    if (!rule) {
      throw new ReminderDomainError(`Reminder rule ${ruleId} was not found.`);
    }

    if (rule.status !== "active") {
      throw new ReminderDomainError(
        "Reminder execution requires an active rule.",
      );
    }

    // Both kinds share the dedupeKey shape so two scheduler ticks within one
    // UTC day collapse to a single execution; the legacy (no-payload) caller
    // keeps its own ISO-suffixed shape.
    const dedupeKey = payload
      ? `${rule.id}:${payload.kind}:${payload.cycleDate}:${recipientEmail}`
      : `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;

    const candidate = adminReminderExecutionSchema.parse({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      reportId: rule.reportId,
      dedupeKey,
      status: "queued",
      scheduledFor: rule.fireAt,
      sentAt: null,
      recipientEmail,
      errorMessage: null,
    });

    const { execution, inserted } = await this.recordExecution(candidate);

    if (!inserted) {
      // dedupeKey embeds recipientEmail for uniqueness; logging it would leak
      // that address, so ruleId is the identifier we surface here.
      this.logger.debug("deduplicated reminder execution", {
        ruleId,
      });
      return adminReminderExecutionSchema.parse(execution);
    }

    this.logger.info("creating reminder execution", { ruleId });

    // Enqueue only after the insert has committed AND only for the caller that
    // inserted the row, so a redundant concurrent tick enqueues nothing.
    if (!this.emailQueue) return execution;
    const queuePayload = payload ?? {
      reportPeriod: await requireRulePeriodLabel(this.repository, rule.id),
    };
    return enqueueOrMarkFailed(
      this.enqueueContext(this.emailQueue),
      execution,
      recipientEmail,
      queuePayload,
    );
  }

  private enqueueContext(queue: JobEnqueuer): EnqueueContext {
    return {
      queue,
      cls: this.cls,
      logger: this.logger,
      markExecutionFailed: this.repository.markExecutionFailed?.bind(
        this.repository,
      ),
    };
  }

  /**
   * Compare-and-set claim used by the email-reminder worker before any send:
   * true only when this caller moved the row `queued → sending`. A false result
   * means a retry, a duplicate worker, or an admin manual retry already claimed
   * (or completed) the execution and the worker must send nothing.
   */
  async claimExecutionForSending(executionId: string): Promise<boolean> {
    if (!this.repository.transitionExecutionToSending) {
      throw new ReminderDomainError(
        "Repository does not support the compare-and-set send claim.",
      );
    }
    return this.repository.transitionExecutionToSending(executionId);
  }

  /** Record a terminal `failed` state after a send error. */
  async markReminderFailed(
    executionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.repository.markExecutionFailed?.(executionId, errorMessage);
  }

  /**
   * Undo a `queued → sending` claim after a retryable dispatch failure, so
   * the next BullMQ attempt's `claimExecutionForSending` can re-claim and
   * actually resend the row instead of finding it permanently stuck.
   */
  async releaseExecutionClaim(executionId: string): Promise<void> {
    await this.repository.releaseExecutionClaim?.(executionId);
  }

  /**
   * Reaper path: re-enqueue an execution stranded in `queued` (its enqueue
   * never happened). Idempotent against the original job and the send guard.
   */
  async reEnqueueStuckExecution(
    execution: AdminReminderExecution,
  ): Promise<void> {
    if (!this.emailQueue) return;
    const rule = await this.repository.getRule(execution.ruleId);
    if (!rule) {
      this.logger.warn("reaper: rule missing for stuck execution", {
        executionId: execution.id,
        ruleId: execution.ruleId,
      });
      return;
    }
    const reportPeriod = await requireRulePeriodLabel(this.repository, rule.id);
    await reEnqueueStuck(
      this.enqueueContext(this.emailQueue),
      execution,
      reportPeriod,
    );
  }

  /**
   * Record the execution row, preferring the repository's atomic
   * insert-on-conflict. Repositories without it (in-memory test doubles) fall
   * back to check-then-insert — safe there because nothing races them;
   * production takes the atomic path.
   */
  private async recordExecution(
    candidate: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
    if (this.repository.insertExecutionOnConflict) {
      return this.repository.insertExecutionOnConflict(candidate);
    }
    const existing = await this.repository.findExecutionByDedupeKey(
      candidate.dedupeKey,
    );
    if (existing) {
      return { execution: existing, inserted: false };
    }
    const saved = await this.repository.saveExecution(candidate);
    return { execution: saved, inserted: true };
  }

  async markReminderSent(executionId: string): Promise<AdminReminderExecution> {
    const execution = await this.repository.getExecution(executionId);

    if (!execution) {
      throw new ReminderDomainError(
        `Reminder execution ${executionId} was not found.`,
      );
    }

    this.logger.info("marking reminder sent", { executionId });
    return this.repository.saveExecution(
      adminReminderExecutionSchema.parse({
        ...execution,
        status: "sent",
        sentAt: new Date(),
      }),
    );
  }

  listExecutions(
    ruleId: string,
    pagination?: PaginationInput,
    recipientAllowlist?: ReadonlySet<string> | null,
  ): Promise<PaginatedResult<AdminReminderExecution>> {
    return paginateReminderExecutions(
      (page) => this.repository.listExecutions(ruleId, page),
      pagination,
      recipientAllowlist,
    );
  }
}
