import { Inject, Injectable } from "@nestjs/common";
import { type Job, type WorkerOptions } from "bullmq";
import { ClsService } from "nestjs-cls";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { errorMessage } from "../../lib/error-message.js";
import type { AppLogger } from "../../lib/logger.js";
import { SnapshotAdminService } from "../../modules/admin/index.js";
import { renderEmail } from "../../modules/email/index.js";
import type {
  DeadlineQueueData,
  EscalationQueueData,
  ReminderQueueJobEnvelope,
} from "../../modules/reminders/index.js";
import {
  parseReminderQueueJobData,
  RemindersService,
} from "../../modules/reminders/index.js";
import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { EMAIL_PORT, type EmailPort } from "../email/email.service";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";
import { describeJobFailureTrace } from "./worker-observability.js";
export type EmailReminderJobData = ReminderQueueJobEnvelope;

// null means "use the SMTP_FROM env default".
type FromOverride = string | null;

// BullMQ discovers this worker through Nest injection, not a direct call.
@Injectable()
export class EmailReminderProcessor extends RawBullMqProcessor<EmailReminderJobData> {
  protected readonly queueName = "email-reminder";
  protected readonly spanName = "email-reminder.process";

  constructor(
    @Inject(RemindersService)
    private readonly remindersService: RemindersService,
    @Inject(EMAIL_PORT) private readonly emailService: EmailPort,
    @Inject(ENV_CONFIG) env: EnvConfig,
    // Surfaces the AppSettings From-address override. A null setting means
    // "use the SMTP_FROM env default".
    @Inject(SnapshotAdminService)
    private readonly snapshotAdminService: SnapshotAdminService,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
    @Inject(WorkerLivenessRegistry)
    workerLiveness?: WorkerLivenessRegistry,
  ) {
    super(env, logger, cls, workerLiveness);
  }

  // Cap SMTP throughput at 5 emails per rolling 60s window so a burst of
  // late-cycle reminders doesn't throttle the corporate mail relay. Jobs that
  // exhaust their retries land in the queue's failed set (the readable DLQ).
  protected override readonly extraWorkerOptions =
    (): Partial<WorkerOptions> => ({
      concurrency: 5,
      limiter: { max: 5, duration: 60_000 },
    });

  protected readonly onJobFailed = (
    job: Job<EmailReminderJobData> | undefined,
    error: Error,
  ): void => {
    const { correlationId, logFields, traceparent, traceId } =
      describeJobFailureTrace(job?.data);
    if (traceparent !== undefined && traceId === undefined) {
      // A malformed traceparent means the enqueuer emitted a bad carrier —
      // reject it loudly so the linkage gap is diagnosable, not silent.
      this.logger.warn("email-reminder job failed with malformed traceparent", {
        executionId: job?.data.executionId,
        attempt: job?.attemptsMade,
        traceparent,
        ...(correlationId ? { correlationId } : {}),
      });
    }
    this.logger.error("email-reminder job failed", {
      executionId: job?.data.executionId,
      attempt: job?.attemptsMade,
      ...logFields,
      error: error.message,
    });
  };

  protected readonly processJob = async (
    job: Job<EmailReminderJobData>,
  ): Promise<void> => {
    // BullMQ is a runtime boundary: validate the complete current envelope
    // before claiming the DB row. A stale kind-less job may fail into the DLQ,
    // but can never consume the claim needed by its current-contract revival.
    const queuedData = parseReminderQueueJobData(job.data);
    const { executionId } = queuedData;

    // Compare-and-set `queued → sending` before any SMTP work: a retry or a
    // duplicate worker that finds the row already claimed loses the transition
    // and acks without sending — the guard against double-delivery.
    const durableData =
      await this.remindersService.claimExecutionForSending(executionId);
    if (!durableData) {
      this.logger.info("email-reminder short-circuit: execution not queued", {
        executionId,
      });
      return;
    }

    try {
      // Redis only identifies the execution. Recipient and renderer fields are
      // read atomically from the claimed DB row, so retrying an old failed job
      // after manual revival cannot send its stale payload.
      await this.dispatchEmail(durableData);
    } catch (error: unknown) {
      // The send never happened, so the row must not stay `sending`. On the
      // last attempt `failed` is terminal; earlier, release the claim back to
      // the pre-claim status the retry's CAS matches, or the retry cannot send.
      const message = errorMessage(error);
      const maxAttempts = job.opts.attempts ?? 1;
      // This catch runs before BullMQ's moveToFailed increments attemptsMade,
      // so the counter still excludes the attempt that just failed — hence +1.
      if (job.attemptsMade + 1 >= maxAttempts) {
        await this.remindersService.markReminderFailed(executionId, message);
      } else {
        await this.remindersService.releaseExecutionClaim(executionId);
      }
      throw error;
    }

    // Outside the try/catch on purpose: if this throws after SMTP, leave the
    // row `sending`. The reaper later records an explicit unknown-delivery
    // terminal failure; automatic ticks never revive it.
    await this.remindersService.markReminderSent(executionId);
  };

  private async dispatchEmail(data: EmailReminderJobData): Promise<void> {
    const fromOverride = (await this.snapshotAdminService.getSettings())
      .notificationFromEmail;

    if (data.kind === "deadline") {
      await this.sendDeadlineReminder(data, fromOverride);
    } else {
      await this.sendEscalationReminder(data, fromOverride);
    }
  }

  private async sendDeadlineReminder(
    data: DeadlineQueueData,
    fromOverride: FromOverride,
  ): Promise<void> {
    const rendered = await renderEmail({
      kind: "deadline",
      props: {
        leadName: data.leadName,
        reportPeriod: data.reportPeriod,
        deadlineIso: data.deadlineIso,
        sectionUrl: data.sectionUrl,
        organization: data.organization,
      },
    });
    await this.emailService.sendMailMultipart(
      data.recipientEmail,
      rendered.subject,
      rendered.html,
      rendered.text,
      fromOverride,
    );
  }

  private async sendEscalationReminder(
    data: EscalationQueueData,
    fromOverride: FromOverride,
  ): Promise<void> {
    const rendered = await renderEmail({
      kind: "escalation",
      props: {
        headName: data.headName,
        cycleDate: data.cycleDate,
        reportPeriod: data.reportPeriod,
        lateLeads: data.lateLeads,
        organization: data.organization,
      },
    });
    await this.emailService.sendMailMultipart(
      data.recipientEmail,
      rendered.subject,
      rendered.html,
      rendered.text,
      fromOverride,
    );
  }
}
