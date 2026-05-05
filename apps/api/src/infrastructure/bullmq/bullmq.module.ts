import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { DLQMonitorService } from './dlq-monitor.service.js';

/**
 * BullMQ infrastructure module.
 *
 * Registers Redis connection (with maxRetriesPerRequest: null for worker
 * compatibility) and two queues: pdf-export and email-reminder.
 *
 * Redis noeviction policy is enforced in Docker Compose config, not in code.
 *
 * 37-02: DLQMonitorService runs alongside the queues, increments
 * cr_dlq_failed_total on terminal job failure and emits an ERROR log when
 * the absolute failed-job count exceeds DLQ_ALERT_THRESHOLD (default 5).
 */
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: Number(process.env['REDIS_PORT'] ?? 6379),
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({ name: 'pdf-export' }),
    BullModule.registerQueue({ name: 'email-reminder' }),
  ],
  providers: [DLQMonitorService],
  exports: [BullModule],
})
export class BullMQModule {}
