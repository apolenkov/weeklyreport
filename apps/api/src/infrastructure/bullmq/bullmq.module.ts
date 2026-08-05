import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { DefaultJobOptions } from "bullmq";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import { DLQMonitorService } from "./dlq-monitor.service.js";
import { QueueRegistry } from "./queue-registry.js";
import {
  SEMANTIC_INDEX_JOB_OPTS,
  SEMANTIC_INDEX_QUEUE_NAME,
} from "./semantic-index-queue-contract.js";

// Bounded completed/failed retention shared by the pdf-export and
// email-reminder queues, matching telegram-outbound's TELEGRAM_OUTBOUND_JOB_OPTS.
const BOUNDED_RETENTION_JOB_OPTS: DefaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

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
    // Bound completed/failed retention so job hashes don't accumulate in Redis
    // without limit (AOF persists them). Mirrors the per-job retention
    // telegram-outbound already sets via TELEGRAM_OUTBOUND_JOB_OPTS.
    BullModule.registerQueue({
      name: "pdf-export",
      defaultJobOptions: BOUNDED_RETENTION_JOB_OPTS,
    }),
    BullModule.registerQueue({
      name: "email-reminder",
      defaultJobOptions: BOUNDED_RETENTION_JOB_OPTS,
    }),
    // telegram-outbound is seeds-only until the bot activates; `attempts: 3` and
    // equivalent retention are set per-job at enqueue time, not on the queue.
    BullModule.registerQueue({ name: "telegram-outbound" }),
    BullModule.registerQueue({
      name: SEMANTIC_INDEX_QUEUE_NAME,
      defaultJobOptions: SEMANTIC_INDEX_JOB_OPTS,
    }),
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
