import type { OrganizationBrand } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { type Job, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import type { AppLogger } from "../../lib/logger.js";
import { SnapshotAdminService } from "../../modules/admin/index.js";
import { renderEmail } from "../../modules/email/index.js";
import { RemindersService } from "../../modules/reminders/index.js";
import type { EnvConfig } from "../config/env.schema";
import type { EmailPort } from "../email/email.service";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import {
  extractTraceId,
  type JobTraceContext,
} from "./worker-observability.js";

// Legacy (kind absent) jobs pre-date the template renderer and send plaintext
// with a hardcoded brand; deadline/escalation jobs render react-email templates
// and carry the enqueue-time organization snapshot.
interface LegacyReminderPayload {
  executionId: string;
  recipientEmail: string;
  reportPeriod: string;
}

interface DeadlineReminderPayload {
  executionId: string;
  recipientEmail: string;
  kind: "deadline";
  leadName: string;
  reportPeriod: string;
  deadlineIso: string;
  sectionUrl: string;
  organization: OrganizationBrand;
}

interface EscalationReminderPayload {
  executionId: string;
  recipientEmail: string;
  kind: "escalation";
  headName: string;
  cycleDate: string;
  reportPeriod: string;
  lateLeads: readonly {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
  organization: OrganizationBrand;
}

export type EmailReminderJobData = JobTraceContext &
  (LegacyReminderPayload | DeadlineReminderPayload | EscalationReminderPayload);

// null means "use the SMTP_FROM env default".
type FromOverride = string | null;

/** BullMQ worker for the email-reminder queue. */
@Injectable()
export class EmailReminderProcessor extends RawBullMqProcessor<EmailReminderJobData> {
  protected readonly queueName = "email-reminder";
  protected readonly spanName = "email-reminder.process";

  constructor(
    private readonly remindersService: RemindersService,
    private readonly emailService: EmailPort,
    env: EnvConfig,
    // Surfaces the AppSettings From-address override. A null setting means
    // "use the SMTP_FROM env default".
    private readonly snapshotAdminService: SnapshotAdminService,
    logger?: AppLogger,
    cls?: ClsService,
  ) {
    super(env, logger, cls);
  }

  // Cap SMTP throughput at 5 emails per rolling 60s window so a burst of
  // late-cycle reminders doesn't throttle the corporate mail relay. Jobs that
  // exhaust their retries land in the queue's failed set (the readable DLQ).
  protected override extraWorkerOptions(): Partial<WorkerOptions> {
    return { concurrency: 5, limiter: { max: 5, duration: 60_000 } };
  }

  protected onJobFailed(
    job: Job<EmailReminderJobData> | undefined,
    error: Error,
  ): void {
    const correlationId = job?.data.correlationId;
    const traceId = job ? extractTraceId(job.data) : undefined;
    this.logger.error("email-reminder job failed", {
      executionId: job?.data.executionId,
      attempt: job?.attemptsMade,
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
      error: error.message,
    });
  }

  protected async processJob(job: Job<EmailReminderJobData>): Promise<void> {
    const { executionId } = job.data;

    // Compare-and-set `queued → sending` before any SMTP work: a retry or a
    // duplicate worker that finds the row already claimed loses the transition
    // and acks without sending — the guard against double-delivery.
    const claimed =
      await this.remindersService.claimExecutionForSending(executionId);
    if (!claimed) {
      this.logger.info("email-reminder short-circuit: execution not queued", {
        executionId,
      });
      return;
    }

    try {
      await this.dispatchEmail(job.data);
    } catch (error: unknown) {
      // The send never happened, so the row must not stay `sending`. On the
      // last attempt `failed` is terminal; earlier, release the claim back to
      // the pre-claim status the retry's CAS matches, or the retry cannot send.
      const message = error instanceof Error ? error.message : String(error);
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

    // Outside the try/catch on purpose: if this throws the send already
    // succeeded, and leaving the row `sending` reads as "delivered,
    // persistence unconfirmed" — better than `failed`, which invites a resend.
    await this.remindersService.markReminderSent(executionId);
  }

  private async dispatchEmail(data: EmailReminderJobData): Promise<void> {
    const fromOverride = (await this.snapshotAdminService.getSettings())
      .notificationFromEmail;

    if ("kind" in data && data.kind === "deadline") {
      await this.sendDeadlineReminder(data, fromOverride);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- job data is an external BullMQ-queue boundary; the kind check guards against unexpected/corrupt payloads though the narrowed union types it as always-escalation
    } else if ("kind" in data && data.kind === "escalation") {
      await this.sendEscalationReminder(data, fromOverride);
    } else {
      await this.sendLegacyReminder(data, fromOverride);
    }
  }

  private async sendDeadlineReminder(
    data: DeadlineReminderPayload,
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
    data: EscalationReminderPayload,
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

  // Legacy plaintext path — preserved verbatim for follow-up reminders that
  // pre-date the template renderer; brand stays hardcoded on this branch.
  private async sendLegacyReminder(
    data: LegacyReminderPayload,
    fromOverride: FromOverride,
  ): Promise<void> {
    const subject = "Reminder: Weekly Status Report Due";
    const body = [
      "Hello,",
      "",
      `This is a reminder to fill in your section for the status report period: ${data.reportPeriod}.`,
      "",
      "Please log in and submit your section before the deadline.",
      "",
      "Thank you.",
    ].join("\n");
    await this.emailService.sendMail(
      data.recipientEmail,
      subject,
      body,
      fromOverride,
    );
  }
}
