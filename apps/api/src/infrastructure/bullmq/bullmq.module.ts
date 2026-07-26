import { BullModule, type RegisterQueueOptions } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { DefaultJobOptions } from "bullmq";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import { DLQMonitorService } from "./dlq-monitor.service.js";
import {
  QUEUE_NAMES,
  type QueueName,
  QueueRegistry,
} from "./queue-registry.js";

// Bounds retained job hashes so they don't accumulate in Redis without limit
// (AOF persists them); mirrors telegram-outbound's per-job retention.
const BOUNDED_RETENTION_JOB_OPTS: DefaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// telegram-outbound is seeds-only until the bot activates; `attempts: 3` and
// equivalent retention are set per-job at enqueue time, not on the queue.
const QUEUES_WITHOUT_BOUNDED_RETENTION: ReadonlySet<QueueName> = new Set([
  "telegram-outbound",
]);

// Derives each registration from the shared QUEUE_NAMES source of truth so a
// renamed/added queue can't drift between this list and the DLQ monitor's.
function registerQueueOptionsFor(name: QueueName): RegisterQueueOptions {
  return QUEUES_WITHOUT_BOUNDED_RETENTION.has(name)
    ? { name }
    : { name, defaultJobOptions: BOUNDED_RETENTION_JOB_OPTS };
}

// Redis noeviction is enforced in Docker Compose, not code.
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV_CONFIG],
      useFactory: (env: EnvConfig) => getBullMQOptions(env),
    }),
    ...QUEUE_NAMES.map((name) =>
      BullModule.registerQueue(registerQueueOptionsFor(name)),
    ),
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
