import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
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
import {
  type ReminderQueuePayload,
  requireRulePeriodLabel,
} from "./reminders-queue-payload.js";
import { RemindersScopeService } from "./reminders-scope.service.js";

export { ReminderDomainError, ReminderScopeError };

interface ReminderExecutionResult {
  execution: AdminReminderExecution;
  outcome: "created" | "revived" | "deduplicated";
}

// Fresh id + queued status per attempt; the dedupe key is what the unique
// index collides on, so a losing insert still returns the winning row.
function buildExecutionCandidate(
  rule: AdminReminderRule,
  recipientEmail: string,
  payload: ReminderExecutionPayload | undefined,
): AdminReminderExecution {
  return adminReminderExecutionSchema.parse({
    id: crypto.randomUUID(),
    ruleId: rule.id,
    reportId: rule.reportId,
    dedupeKey: resolveReminderDedupeKey(rule, recipientEmail, payload),
    status: "queued",
    scheduledFor: rule.fireAt,
    sentAt: null,
    recipientEmail,
    errorMessage: null,
  });
}

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: RemindersEnqueuer | null;
  // Composed scope surface; router calls remindersService.scope.* directly.
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

  // Shared dedupe key; enqueue only when this call inserted the row.
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

  // Returns created | revived | deduplicated from the atomic insert — counters need this.
  async requestReminderExecutionWithOutcome(
    ruleId: string,
    recipientEmail: string,
    payload?: ReminderExecutionPayload,
  ): Promise<ReminderExecutionResult> {
    const rule = await this.loadActiveRule(ruleId);

    const { execution, inserted } = await recordExecutionOnConflict(
      this.repository,
      buildExecutionCandidate(rule, recipientEmail, payload),
    );

    // Lazy: only the paths that actually enqueue may pay the period-label read.
    const queuePayload = async () =>
      payload ?? {
        reportPeriod: await requireRulePeriodLabel(this.repository, rule.id),
      };

    if (!inserted) {
      return this.resolveExistingExecution(
        ruleId,
        execution,
        recipientEmail,
        queuePayload,
      );
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

  private async loadActiveRule(ruleId: string) {
    const rule = await this.repository.getRule(ruleId);

    if (!rule) {
      throw new ReminderDomainError(`Reminder rule ${ruleId} was not found.`);
    }

    if (rule.status !== "active") {
      throw new ReminderDomainError(
        "Reminder execution requires an active rule.",
      );
    }

    return rule;
  }

  // The insert lost the race: revive a failed row if we can, else report dedupe.
  private async resolveExistingExecution(
    ruleId: string,
    execution: AdminReminderExecution,
    recipientEmail: string,
    queuePayload: () => Promise<ReminderQueuePayload>,
  ): Promise<ReminderExecutionResult> {
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

  // CAS claim: true only when this caller moved queued → sending.
  async claimExecutionForSending(executionId: string): Promise<boolean> {
    return this.repository.transitionExecutionToSending(executionId);
  }

  async markReminderFailed(
    executionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.repository.markExecutionFailed(executionId, errorMessage);
  }

  // Undo sending claim after retryable failure so the next attempt can re-claim.
  async releaseExecutionClaim(executionId: string): Promise<void> {
    await this.repository.releaseExecutionClaim(executionId);
  }

  // Reaper: re-enqueue a stranded queued execution (enqueue never happened).
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
