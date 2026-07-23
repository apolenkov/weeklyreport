import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import { ReminderDomainError, ReminderScopeError } from "./reminders.errors.js";
import {
  NOOP_REMINDERS_TELEMETRY,
  type RemindersEnqueuer,
  type RemindersTelemetry,
} from "./reminders.ports.js";
import type {
  ReminderExecutionPayload,
  RemindersRepository,
} from "./reminders.types.js";
import { resolveReminderDedupeKey } from "./reminders-dedupe-key.js";
import {
  type EnqueueContext,
  enqueueOrMarkFailed,
  recordExecutionOnConflict,
  reEnqueueStuck,
  reviveFailedExecution,
} from "./reminders-enqueue.js";
import { paginateReminderExecutions } from "./reminders-execution-pagination.js";
import { requireRulePeriodLabel } from "./reminders-queue-payload.js";
import { RemindersScopeService } from "./reminders-scope.service.js";

export { ReminderDomainError, ReminderScopeError };

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: RemindersEnqueuer | null;
  /**
   * Scope-authorization + dispatch surface for the reminders.* procedures
   * (see `RemindersScopeService`). Composed, not inherited, so the router
   * calls `remindersService.scope.authorizeExecute(...)` etc. directly.
   */
  readonly scope: RemindersScopeService;

  constructor(
    private readonly repository: RemindersRepository,
    logger?: AppLogger,
    emailQueue?: RemindersEnqueuer,
    private readonly telemetry: RemindersTelemetry = NOOP_REMINDERS_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
    this.emailQueue = emailQueue ?? null;
    this.scope = new RemindersScopeService(repository, (ruleId, email) =>
      this.requestReminderExecutionWithOutcome(ruleId, email),
    );
  }

  /**
   * Record (idempotently) and enqueue one reminder execution. The dedupe key
   * (`resolveReminderDedupeKey`) is shared with every other caller so a
   * manual dispatch collides with an already-sent automated reminder for the
   * same rule/recipient/cycle. The email job is enqueued only when this call
   * actually inserted the row, so a concurrent duplicate tick enqueues
   * nothing.
   */
  async requestReminderExecution(
    ruleId: string,
    recipientEmail: string,
    payload?: ReminderExecutionPayload,
  ): Promise<AdminReminderExecution> {
    const { execution } = await this.requestReminderExecutionWithOutcome(
      ruleId,
      recipientEmail,
      payload,
    );
    return execution;
  }

  /**
   * Same as `requestReminderExecution`, plus the atomic dispatch outcome the
   * insert itself proved: "created" (this call inserted and enqueued),
   * "revived" (an earlier failed row was re-queued — a send WILL happen), or
   * "deduplicated" (an earlier execution already owns this dedupe key). The
   * outcome is the ground truth counters need — no timestamp comparison can
   * substitute for it.
   */
  async requestReminderExecutionWithOutcome(
    ruleId: string,
    recipientEmail: string,
    payload?: ReminderExecutionPayload,
  ): Promise<{
    execution: AdminReminderExecution;
    outcome: "created" | "revived" | "deduplicated";
  }> {
    const rule = await this.repository.getRule(ruleId);

    if (!rule) {
      throw new ReminderDomainError(`Reminder rule ${ruleId} was not found.`);
    }

    if (rule.status !== "active") {
      throw new ReminderDomainError(
        "Reminder execution requires an active rule.",
      );
    }

    const dedupeKey = resolveReminderDedupeKey(rule, recipientEmail, payload);

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

    const { execution, inserted } = await recordExecutionOnConflict(
      this.repository,
      candidate,
    );

    const queuePayload = async () =>
      payload ?? {
        reportPeriod: await requireRulePeriodLabel(this.repository, rule.id),
      };

    if (!inserted) {
      const revived = await reviveFailedExecution(
        this.emailQueue ? this.enqueueContext(this.emailQueue) : null,
        this.repository.requeueFailedExecution.bind(this.repository),
        execution,
        recipientEmail,
        queuePayload,
      );
      if (revived) return { execution: revived, outcome: "revived" };
      // dedupeKey embeds recipientEmail for uniqueness; logging it would
      // leak that address, so ruleId is the identifier we surface here.
      this.logger.debug("deduplicated reminder execution", { ruleId });
      return {
        execution: adminReminderExecutionSchema.parse(execution),
        outcome: "deduplicated",
      };
    }

    this.logger.info("creating reminder execution", { ruleId });

    // Enqueue only after the insert has committed AND only for the caller that
    // inserted the row, so a redundant concurrent tick enqueues nothing.
    if (!this.emailQueue) {
      return {
        execution: adminReminderExecutionSchema.parse(execution),
        outcome: "created",
      };
    }
    return {
      execution: await enqueueOrMarkFailed(
        this.enqueueContext(this.emailQueue),
        execution,
        recipientEmail,
        await queuePayload(),
      ),
      outcome: "created",
    };
  }

  private enqueueContext(queue: RemindersEnqueuer): EnqueueContext {
    return {
      queue,
      telemetry: this.telemetry,
      logger: this.logger,
      markExecutionFailed: this.repository.markExecutionFailed.bind(
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
    return this.repository.transitionExecutionToSending(executionId);
  }

  /** Record a terminal `failed` state after a send error. */
  async markReminderFailed(
    executionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.repository.markExecutionFailed(executionId, errorMessage);
  }

  /**
   * Undo a `queued → sending` claim after a retryable dispatch failure, so
   * the next BullMQ attempt's `claimExecutionForSending` can re-claim and
   * actually resend the row instead of finding it permanently stuck.
   */
  async releaseExecutionClaim(executionId: string): Promise<void> {
    await this.repository.releaseExecutionClaim(executionId);
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
