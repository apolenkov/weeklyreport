import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';

import { RemindersService } from '../../modules/reminders/reminders.service';
import { EmailService } from '../email/email.service';

type EmailReminderJobData = {
  executionId: string;
  recipientEmail: string;
  reportPeriod: string;
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
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: Number(process.env['REDIS_PORT'] ?? 6379),
          maxRetriesPerRequest: null,
        },
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
    const { executionId, recipientEmail, reportPeriod } = job.data;

    const subject = 'Reminder: Weekly Status Report Due';
    const body = [
      'Hello,',
      '',
      `This is a reminder to fill in your section for the status report period: ${reportPeriod}.`,
      '',
      'Please log in to CustomReport and submit your section before the deadline.',
      '',
      'Thank you.',
    ].join('\n');

    await this.emailService.sendMail(recipientEmail, subject, body);
    await this.remindersService.markReminderSent(executionId);
  }
}
