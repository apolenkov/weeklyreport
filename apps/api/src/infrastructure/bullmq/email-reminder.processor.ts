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
type EmailReminderJobData = JobTraceContext &
  (
    | {
        executionId: string;
        recipientEmail: string;
        reportPeriod: string;
      }
    | {
        executionId: string;
        recipientEmail: string;
        kind: "deadline";
        leadName: string;
        reportPeriod: string;
        deadlineIso: string;
        sectionUrl: string;
        organization: OrganizationBrand;
      }
    | {
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
  );

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

    // Compare-and-set the execution `queued → sending` before any SMTP work.
    // A retry, a duplicate worker, or an admin `job.retry()` that finds the row
    // already claimed loses the transition and acks without sending — the guard
    // against double-delivery.
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
      // Dispatch failed — the send never happened, so the row must not stay
      // permanently `sending`. On the final attempt there is no retry left to
      // re-claim it, so `failed` is terminal and correct. On any earlier
      // attempt, release the claim back to the pre-claim status so BullMQ's
      // retry can call claimExecutionForSending again and actually resend;
      // marking it `failed` here would defeat the retry (the CAS only
      // matches the pre-claim status).
      const message = error instanceof Error ? error.message : String(error);
      const attemptsUsed = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      if (attemptsUsed >= maxAttempts) {
        await this.remindersService.markReminderFailed(executionId, message);
      } else {
        await this.remindersService.releaseExecutionClaim(executionId);
      }
      throw error;
    }

    // Outside the try/catch on purpose: if this throws, the send already
    // succeeded and the row should stay `sending` rather than being marked
    // `failed` (which would invite a duplicate resend) or `sent` (which
    // would be a lie if the write never lands). `sending` here reads as
    // "delivered, persistence unconfirmed — needs investigation."
    await this.remindersService.markReminderSent(executionId);
  }

  private async dispatchEmail(data: EmailReminderJobData): Promise<void> {
    const fromOverride = (await this.snapshotAdminService.getSettings())
      .notificationFromEmail;

    if ("kind" in data && data.kind === "deadline") {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- job data is an external BullMQ-queue boundary; the kind check guards against unexpected/corrupt payloads though the narrowed union types it as always-escalation
    } else if ("kind" in data && data.kind === "escalation") {
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
    } else {
      // Legacy plaintext path — preserved verbatim for follow-up reminders that
      // pre-date the template renderer; brand stays hardcoded on this branch.
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
}
