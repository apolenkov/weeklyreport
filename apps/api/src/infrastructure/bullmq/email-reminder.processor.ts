import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { AdminService } from "../../modules/admin/admin.service";
import { renderEmail } from "../../modules/email/render-template";
import { RemindersService } from "../../modules/reminders/reminders.service";
import type { EnvConfig } from "../config/env.schema";
import { EmailService } from "../email/email.service";
import { getBullMQOptions } from "./bullmq-options";
import {
  extractTraceId,
  type JobTraceContext,
  runInJobTraceContext,
} from "./worker-observability.js";

/**
 * NOTIF-01 (Phase 28-03): job-data shape for the email-reminder queue.
 *
 * Two flavours coexist during the staged migration:
 *  - LEGACY (kind absent): pre-Phase-28 follow-up jobs scheduled by the v2.0
 *    code path. Body is plaintext, no template rendering.
 *  - DEADLINE (kind === 'deadline'): the new scheduler path. Body is
 *    rendered via `renderEmail({kind:'deadline', props})` and sent multipart.
 *
 * Phase 29 will collapse the union once 'follow-up' and 'escalation' kinds
 * adopt the same template renderer.
 */
// UFB-047 / Phase 49-01: brand snapshot threaded through every Phase-28+
// payload. Legacy v2.0 (kind absent) does not carry it — that branch
// hardcodes the brand and is scheduled for removal once Phase 28+ kinds
// dominate the queue.
interface ReminderOrganizationJob {
  shortName: string;
  fullName: string;
}

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

/**
 * BullMQ worker for the email-reminder queue.
 *
 * Uses raw Worker (not @Processor/WorkerHost) to avoid the DiscoveryService
 * DI bug in @nestjs/bullmq 11 with NestJS 11.
 */
@Injectable()
export class EmailReminderProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<EmailReminderJobData> | undefined;
  private readonly logger: AppLogger;

  constructor(
    private readonly remindersService: RemindersService,
    private readonly emailService: EmailService,
    private readonly env: EnvConfig,
    // AdminService surfaces the AppSettings singleton. We read
    // `notificationFromEmail` once per job and pass it through to EmailService
    // so admin can swap the From-address without redeploying. `null` (default)
    // → EmailService falls back to SMTP_FROM env. Marked optional to keep the
    // test-time constructor call sites (which instantiate the processor without
    // DI) compiling unchanged — the processor degrades gracefully if not wired.
    private readonly adminService?: AdminService,
    logger?: AppLogger,
    private readonly cls?: ClsService,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  onModuleInit(): void {
    this.worker = new Worker<EmailReminderJobData>(
      "email-reminder",
      async (job: Job<EmailReminderJobData>) => {
        await runInJobTraceContext(
          job.data,
          "email-reminder.process",
          this.cls,
          () => this.processJob(job),
        );
      },
      {
        ...getBullMQOptions(this.env),
        // NOTIF-06 (Phase 29-05): BullMQ rate-limit at the worker level.
        // Caps SMTP throughput at 5 emails per rolling 60s window so a burst
        // of late-cycle reminders does not throttle the corporate mail relay.
        // BullMQ semantics: failed jobs after `attempts` retries land in the
        // queue's failed-jobs set automatically — this is the DLQ readable
        // via `queue.getFailedCount()` from the admin DLQ tRPC procedure.
        concurrency: 5,
        limiter: { max: 5, duration: 60_000 },
      },
    );

    this.worker.on("failed", (job, error) => {
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
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<EmailReminderJobData>): Promise<void> {
    const data = job.data;

    // UFB-048 / Phase 50-A: pull the admin-configured From-address. Null
    // is a valid value (means "use env default"), and a missing
    // adminService (test-time DI fallback) skips the lookup entirely.
    const fromOverride = this.adminService
      ? (await this.adminService.getSettings()).notificationFromEmail
      : null;

    if ("kind" in data && data.kind === "deadline") {
      // NOTIF-01 (Phase 28-03): render react-email + Tailwind template +
      // matching plaintext, send multipart.
      const rendered = await renderEmail({
        kind: "deadline",
        props: {
          leadName: data.leadName,
          reportPeriod: data.reportPeriod,
          deadlineIso: data.deadlineIso,
          sectionUrl: data.sectionUrl,
          // UFB-047 / Phase 49-01: brand snapshot from enqueue time.
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
      // NOTIF-02 (Phase 29-05): T+2h escalation digest — one email per
      // (rule, head) per cycle, body aggregates ALL late leads.
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
      // Legacy v2.0 path — preserved verbatim for follow-up reminders that
      // pre-date the Phase 28 template renderer. Brand stays hardcoded on
      // this branch; once the legacy queue drains we drop this code path.
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
