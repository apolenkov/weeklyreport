import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';

import { RemindersService } from '../../modules/reminders/reminders.service';
import { EmailService } from '../email/email.service';
import { renderEmail } from '../../modules/email/render-template';
import { getBullMQOptions } from './bullmq-options';

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
type EmailReminderJobData =
  | {
      executionId: string;
      recipientEmail: string;
      reportPeriod: string;
    }
  | {
      executionId: string;
      recipientEmail: string;
      kind: 'deadline';
      leadName: string;
      reportPeriod: string;
      deadlineIso: string;
      sectionUrl: string;
    }
  | {
      executionId: string;
      recipientEmail: string;
      kind: 'escalation';
      headName: string;
      cycleDate: string;
      reportPeriod: string;
      lateLeads: ReadonlyArray<{
        leadName: string;
        sectionTitle: string;
        deadlineIso: string;
      }>;
    };

/**
 * BullMQ worker for the email-reminder queue.
 *
 * Uses raw Worker (not @Processor/WorkerHost) to avoid the DiscoveryService
 * DI bug in @nestjs/bullmq 11 with NestJS 11.
 */
@Injectable()
export class EmailReminderProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<EmailReminderJobData> | undefined;

  constructor(
    private readonly remindersService: RemindersService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<EmailReminderJobData>(
      'email-reminder',
      async (job: Job<EmailReminderJobData>) => {
        await this.processJob(job);
      },
      {
        ...getBullMQOptions(),
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

    this.worker.on('failed', (job, error) => {
      process.stderr.write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'email-reminder job failed',
          executionId: job?.data.executionId,
          recipientEmail: job?.data.recipientEmail,
          attempt: job?.attemptsMade,
          error: error.message,
        }) + '\n',
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<EmailReminderJobData>): Promise<void> {
    const data = job.data;

    if ('kind' in data && data.kind === 'deadline') {
      // NOTIF-01 (Phase 28-03): render react-email + Tailwind template +
      // matching plaintext, send multipart.
      const rendered = await renderEmail({
        kind: 'deadline',
        props: {
          leadName: data.leadName,
          reportPeriod: data.reportPeriod,
          deadlineIso: data.deadlineIso,
          sectionUrl: data.sectionUrl,
        },
      });
      await this.emailService.sendMailMultipart(
        data.recipientEmail,
        rendered.subject,
        rendered.html,
        rendered.text,
      );
    } else if ('kind' in data && data.kind === 'escalation') {
      // NOTIF-02 (Phase 29-05): T+2h escalation digest — one email per
      // (rule, head) per cycle, body aggregates ALL late leads.
      const rendered = await renderEmail({
        kind: 'escalation',
        props: {
          headName: data.headName,
          cycleDate: data.cycleDate,
          reportPeriod: data.reportPeriod,
          lateLeads: data.lateLeads,
        },
      });
      await this.emailService.sendMailMultipart(
        data.recipientEmail,
        rendered.subject,
        rendered.html,
        rendered.text,
      );
    } else {
      // Legacy v2.0 path — preserved verbatim for follow-up reminders that
      // pre-date the Phase 28 template renderer.
      const subject = 'Reminder: Weekly Status Report Due';
      const body = [
        'Hello,',
        '',
        `This is a reminder to fill in your section for the status report period: ${data.reportPeriod}.`,
        '',
        'Please log in to CustomReport and submit your section before the deadline.',
        '',
        'Thank you.',
      ].join('\n');
      await this.emailService.sendMail(data.recipientEmail, subject, body);
    }

    await this.remindersService.markReminderSent(data.executionId);
  }
}
