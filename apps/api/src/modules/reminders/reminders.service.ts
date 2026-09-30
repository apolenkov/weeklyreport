import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import type { AppLogger } from "../../lib/logger";
import { OrganizationService } from "../organization/index.js";
import {
  ReminderDomainError,
  ReminderExecutionIneligibleError,
  ReminderScopeError,
} from "./reminders.errors.js";
import {
  NOOP_REMINDERS_TELEMETRY,
  type RemindersEnqueuer,
  type RemindersTelemetry,
} from "./reminders.ports.js";
import type {
  ReminderExecutionPayload,
  ReminderExecutionRecordResult,
  ReminderExecutionResult,
  RemindersRepository,
} from "./reminders.types.js";
import {
  buildExecutionCandidate,
  type EnqueueContext,
  enqueueOrMarkFailed,
  recordExecutionOnConflict,
  reEnqueueStuck,
} from "./reminders-enqueue.js";
import { paginateReminderExecutions } from "./reminders-execution-pagination.js";
import {
  buildPersistedQueuePayload,
  buildReminderQueueJobData,
  type ReminderQueueJobData,
  requireRulePeriodLabel,
} from "./reminders-queue-payload.js";
import { RemindersScopeService } from "./reminders-scope.service.js";

const ISO_DATE_LENGTH = 10;

export { ReminderDomainError, ReminderScopeError };

function toDispatchResult(
  record: ReminderExecutionRecordResult,
): ReminderExecutionResult {
  return record.execution.status === "failed"
    ? { execution: record.execution, outcome: "failed" }
    : record;
}

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: RemindersEnqueuer | null;
  // Composed scope surface; router calls remindersService.scope.* directly.
  readonly scope: RemindersScopeService;

  constructor(
    private readonly repository: RemindersRepository,
    logger: AppLogger,
    emailQueue?: RemindersEnqueuer,
    private readonly telemetry: RemindersTelemetry = NOOP_REMINDERS_TELEMETRY,
    private readonly organizationService?: OrganizationService,
    private readonly env?: Pick<EnvConfig, "APP_BASE_URL">,
  ) {
    this.logger = logger;
    this.emailQueue = emailQueue ?? null;
    this.scope = new RemindersScopeService(
      repository,
      async (ruleId, email, deadline, leadName) =>
        this.requestReminderExecutionWithOutcome(
          ruleId,
          email,
          await this.buildManualPayload(ruleId, deadline, leadName),
          "manual",
        ),
      this.logger,
    );
  }

  private async buildManualPayload(
    ruleId: string,
    deadline: Date,
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
      deadlineIso: deadline.toISOString(),
      sectionUrl: `${this.env.APP_BASE_URL}/lead/report/${rule.reportId}`,
      organization,
    };
  }

  // Shared dedupe key; enqueue only when this call creates or revives the row.
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
    if (!execution) {
      throw new ReminderDomainError(
        "Reminder execution requires an editable report and active rule.",
      );
    }
    return execution;
  }

  // Combine the atomic record outcome with enqueue failure before callers tally.
  async requestReminderExecutionWithOutcome(
    ruleId: string,
    recipientEmail: string,
    payload: ReminderExecutionPayload,
    dispatchSource: "automatic" | "manual" = "automatic",
  ): Promise<ReminderExecutionResult> {
    const rule = await this.loadActiveRule(ruleId);
    const queuePayload = buildPersistedQueuePayload(payload);
    const recorded = await recordExecutionOnConflict(
      this.repository,
      buildExecutionCandidate(rule, recipientEmail, payload),
      queuePayload,
      dispatchSource === "manual" && this.emailQueue !== null,
    ).catch((error: unknown) => {
      if (!(error instanceof ReminderExecutionIneligibleError)) throw error;
      this.logger.debug("skipped stale reminder execution", { ruleId });
      return null;
    });
    if (!recorded) return { execution: null, outcome: "skipped" };
    const { execution, outcome } = recorded;
    if (outcome === "deduplicated") {
      if (
        dispatchSource === "manual" &&
        execution.status === "failed" &&
        !this.emailQueue
      ) {
        throw new ReminderDomainError(
          "Cannot revive a failed reminder execution: no email queue is wired.",
        );
      }
      this.logger.debug("deduplicated reminder execution", { ruleId });
      return toDispatchResult(recorded);
    }

    this.logger.info(`${outcome} reminder execution`, { ruleId });

    // Enqueue only after the transaction commits and only for the caller that
    // created or revived the row, so a redundant concurrent tick enqueues nothing.
    if (!this.emailQueue) {
      return {
        execution: adminReminderExecutionSchema.parse(execution),
        outcome,
      };
    }
    const enqueued = await enqueueOrMarkFailed(
      this.enqueueContext(this.emailQueue),
      execution,
      recipientEmail,
      queuePayload,
      outcome === "revived"
        ? `${execution.id}:revive:${crypto.randomUUID()}`
        : undefined,
    );
    return toDispatchResult({ execution: enqueued, outcome });
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

  // CAS claim returns the durable renderer input from the same DB write.
  async claimExecutionForSending(
    executionId: string,
  ): Promise<ReminderQueueJobData | null> {
    const claimed =
      await this.repository.transitionExecutionToSending(executionId);
    return claimed
      ? buildReminderQueueJobData(
          executionId,
          claimed.recipientEmail,
          claimed.queuePayload,
        )
      : null;
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

  // SMTP outcome cannot be inferred after a crash. Terminalize the ambiguous
  // row for alerting/manual review; automation must never retry it.
  async reconcileStuckSendingExecutions(olderThan: Date): Promise<number> {
    const reconciled =
      await this.repository.markStuckSendingUncertain(olderThan);
    if (reconciled > 0) {
      this.telemetry.recordUncertainDelivery(reconciled);
      this.logger.warn("terminalized reminders with unknown delivery outcome", {
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
