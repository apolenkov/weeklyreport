import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';

import { RemindersService } from '../../modules/reminders/reminders.service';
import { EmailService } from '../email/email.service';

type EmailReminderJobData = {
  executionId: string;
  recipientEmail: string;
  reportPeriod: string;
};

/**
 * BullMQ processor for the email-reminder queue.
 *
 * Sends an SMTP reminder email to the lead and marks the execution as sent.
 * Deduplication is handled upstream by RemindersService (dedupeKey check).
 */
@Injectable()
@Processor('email-reminder')
export class EmailReminderProcessor extends WorkerHost {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<EmailReminderJobData>): Promise<void> {
    const { executionId, recipientEmail, reportPeriod } = job.data;

    const subject = 'Reminder: Weekly Status Report Due';
    const body = [
      `Hello,`,
      ``,
      `This is a reminder to fill in your section for the status report period: ${reportPeriod}.`,
      ``,
      `Please log in to CustomReport and submit your section before the deadline.`,
      ``,
      `Thank you.`,
    ].join('\n');

    await this.emailService.sendMail(recipientEmail, subject, body);
    await this.remindersService.markReminderSent(executionId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailReminderJobData>, error: Error): void {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'email-reminder job failed',
        executionId: job.data.executionId,
        recipientEmail: job.data.recipientEmail,
        attempt: job.attemptsMade,
        error: error.message,
      }) + '\n',
    );
  }
}
