import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import { DLQMonitorService } from "./dlq-monitor.service.js";
import { QueueRegistry } from "./queue-registry.js";

/**
 * BullMQ infrastructure module.
 *
 * Registers the Redis connection (maxRetriesPerRequest: null for worker
 * compatibility) and the pdf-export, email-reminder, and telegram-outbound
 * queues. Redis noeviction policy is enforced in Docker Compose, not code.
 *
 * QueueRegistry owns one shared `Queue` handle per name (injected by the DLQ
 * monitor, Bull Board, and the admin bootstrap queues); DLQMonitorService
 * counts terminal failures and alerts when the failed-job count exceeds
 * DLQ_ALERT_THRESHOLD.
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV_CONFIG],
      useFactory: (env: EnvConfig) => getBullMQOptions(env),
    }),
    BullModule.registerQueue({ name: "pdf-export" }),
    BullModule.registerQueue({ name: "email-reminder" }),
    // telegram-outbound is seeds-only until the bot activates; `attempts: 3` is
    // set per-job at enqueue time, not on the queue.
    BullModule.registerQueue({ name: "telegram-outbound" }),
  ],
  providers: [
    {
      provide: QueueRegistry,
      useFactory: (env: EnvConfig) => new QueueRegistry(env),
      inject: [ENV_CONFIG],
    },
    {
      provide: DLQMonitorService,
      useFactory: (registry: QueueRegistry, env: EnvConfig) =>
        new DLQMonitorService(registry, env),
      inject: [QueueRegistry, ENV_CONFIG],
    },
  ],
  exports: [BullModule, QueueRegistry],
})
export class BullMQModule {}
