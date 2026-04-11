import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

/**
 * BullMQ infrastructure module.
 *
 * Registers Redis connection (with maxRetriesPerRequest: null for worker
 * compatibility) and two queues: pdf-export and email-reminder.
 *
 * Redis noeviction policy is enforced in Docker Compose config, not in code.
 */
@Global()
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
  exports: [BullModule],
})
export class BullMQModule {}
