import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { OrganizationService } from "../organization/index.js";
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
import {
  buildExecutionCandidate,
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

const ISO_DATE_LENGTH = 10;

export { ReminderDomainError, ReminderScopeError };

interface ReminderExecutionResult {
  readonly execution: AdminReminderExecution;
  readonly outcome: "created" | "revived" | "deduplicated";
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
    private readonly organizationService?: OrganizationService,
    private readonly env?: Pick<EnvConfig, "APP_BASE_URL">,
  ) {
    this.logger = logger ?? createNullLogger();
    this.emailQueue = emailQueue ?? null;
    this.scope = new RemindersScopeService(
      repository,
      async (ruleId, email, leadName) =>
        this.requestReminderExecutionWithOutcome(
          ruleId,
          email,
          await this.buildManualPayload(ruleId, leadName),
        ),
    );
  }

  private async buildManualPayload(
    ruleId: string,
    leadName?: string,
  ): Promise<ReminderExecutionPayload> {
    if (!leadName || !this.organizationService || !this.env) {
      throw new ReminderDomainError(
        "Manual reminder dispatch requires live lead and organization context.",
      );
    }
    const rule = await this.repository.getRule(ruleId);
    const reportPeriod = await requireRulePeriodLabel(this.repository, ruleId);
    if (!rule?.reportId || rule.kind !== "deadline") {
      throw new ReminderDomainError(
        "Manual reminder dispatch requires an active deadline rule.",
      );
    }
    const organization = await this.organizationService.getPublic();
    return {
      kind: "deadline",
      cycleDate: rule.fireAt.toISOString().slice(0, ISO_DATE_LENGTH),
      leadName,
      reportPeriod,
      deadlineIso: rule.fireAt.toISOString(),
      sectionUrl: `${this.env.APP_BASE_URL}/lead/report/${rule.reportId}`,
      organization,
    };
  }

  // Shared dedupe key; enqueue only when this call inserted the row.
  async requestReminderExecution(
    ruleId: string,
    recipientEmail: string,
    payload: ReminderExecutionPayload,
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
    payload: ReminderExecutionPayload,
  ): Promise<ReminderExecutionResult> {
    const rule = await this.loadActiveRule(ruleId);
    const { execution, inserted } = await recordExecutionOnConflict(
      this.repository,
      buildExecutionCandidate(rule, recipientEmail, payload),
      payload,
    );

    const persistedQueuePayload = async () => {
      const persisted = await this.repository.getExecutionQueuePayload(
        execution.id,
      );
      if (persisted) return persisted;
      // The payload-contract migration quarantines pre-contract queued rows as
      // failed. Their next eligible dispatch supplies a complete current
      // snapshot, which the failed→queued CAS persists atomically.
      if (execution.status === "failed") return payload;
      throw new ReminderDomainError(
        `Reminder execution ${execution.id} has no persisted email payload.`,
      );
    };

    if (!inserted) {
      return this.resolveExistingExecution(
        ruleId,
        execution,
        recipientEmail,
        persistedQueuePayload,
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
        payload,
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
    const queue = this.emailQueue;
    if (queue) {
      const revived = await reviveFailedExecution(
        this.enqueueContext(queue),
        this.repository.requeueFailedExecution.bind(this.repository),
        execution,
        recipientEmail,
        queuePayload,
      );
      if (revived) return { execution: revived, outcome: "revived" };
    } else if (execution.status === "failed") {
      // Without a queue there is no job to enqueue — reviving would leave a
      // queued row with no worker. Fail loud instead of a silent dead state.
      throw new ReminderDomainError(
        "Cannot revive a failed reminder execution: no email queue is wired.",
      );
    }
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
    const payload = await this.repository.getExecutionQueuePayload(
      execution.id,
    );
    if (!payload) {
      throw new ReminderDomainError(
        `Reminder execution ${execution.id} has no persisted email payload.`,
      );
    }
    await reEnqueueStuck(
      this.enqueueContext(this.emailQueue),
      execution,
      payload,
    );
  }

  // Reaper: resolve `sending` rows presumed delivered after a worker crashed
  // mid-write, so no delivery can stay in-flight forever.
  async reconcileStuckSendingExecutions(olderThan: Date): Promise<number> {
    const reconciled = await this.repository.markStuckSendingSent(olderThan);
    if (reconciled > 0) {
      this.logger.info("reconciled stuck sending executions as sent", {
        reconciled,
      });
    }
    return reconciled;
  }

  async markReminderSent(executionId: string): Promise<AdminReminderExecution> {
    this.logger.info("marking reminder sent", { executionId });
    const sent = await this.repository.markExecutionSent(
      executionId,
      new Date(),
    );
    if (sent) return sent;

    const execution = await this.repository.getExecution(executionId);
    if (!execution) {
      throw new ReminderDomainError(
        `Reminder execution ${executionId} was not found.`,
      );
    }
    throw new ReminderDomainError(
      `Reminder execution ${executionId} is not claimed for sending.`,
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
