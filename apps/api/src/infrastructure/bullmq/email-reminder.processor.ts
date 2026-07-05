import { Injectable } from "@nestjs/common";
import { type Job, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import type { AppLogger } from "../../lib/logger.js";
import { AdminService } from "../../modules/admin/admin.service";
import { renderEmail } from "../../modules/email/render-template";
import { RemindersService } from "../../modules/reminders/reminders.service";
import type { EnvConfig } from "../config/env.schema";
import { EmailService } from "../email/email.service";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import {
  extractTraceId,
  type JobTraceContext,
} from "./worker-observability.js";

interface ReminderOrganizationJob {
  shortName: string;
  fullName: string;
}

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
        organization: ReminderOrganizationJob;
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
        organization: ReminderOrganizationJob;
      }
  );

/** BullMQ worker for the email-reminder queue. */
@Injectable()
export class EmailReminderProcessor extends RawBullMqProcessor<EmailReminderJobData> {
  protected readonly queueName = "email-reminder";
  protected readonly spanName = "email-reminder.process";

  constructor(
    private readonly remindersService: RemindersService,
    private readonly emailService: EmailService,
    env: EnvConfig,
    // Optional: surfaces the AppSettings From-address override. Missing at
    // test time (DI fallback); null means "use the SMTP_FROM env default".
    private readonly adminService?: AdminService,
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
      recipientEmail: job?.data.recipientEmail,
      attempt: job?.attemptsMade,
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
      error: error.message,
    });
  }

  protected async processJob(job: Job<EmailReminderJobData>): Promise<void> {
    const data = job.data;

    // null is a valid value ("use env default"); a missing adminService
    // (test-time DI fallback) skips the lookup entirely.
    const fromOverride = this.adminService
      ? (await this.adminService.getSettings()).notificationFromEmail
      : null;

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

    await this.remindersService.markReminderSent(data.executionId);
  }
}
