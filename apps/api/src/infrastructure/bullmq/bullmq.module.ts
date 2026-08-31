import {
  BullModule,
  getQueueToken,
  type RegisterQueueOptions,
} from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { DefaultJobOptions, Queue } from "bullmq";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import { DLQMonitorService } from "./dlq-monitor.service.js";
import {
  QUEUE_NAMES,
  type QueueName,
  QueueRegistry,
} from "./queue-registry.js";
import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";

// Bound retained job hashes so they don't accumulate in Redis without limit.
const BOUNDED_RETENTION_JOB_OPTS: DefaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// Derives each registration from the shared QUEUE_NAMES source of truth so a
// renamed/added queue can't drift between this list and the DLQ monitor's.
function registerQueueOptionsFor(name: QueueName): RegisterQueueOptions {
  return { name, defaultJobOptions: BOUNDED_RETENTION_JOB_OPTS };
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
    WorkerLivenessRegistry,
    {
      provide: QueueRegistry,
      useFactory: (...queues: Queue[]) => new QueueRegistry(queues),
      inject: QUEUE_NAMES.map((name) => getQueueToken(name)),
    },
    {
      provide: DLQMonitorService,
      useFactory: (registry: QueueRegistry, env: EnvConfig) =>
        new DLQMonitorService(registry, env),
      inject: [QueueRegistry, ENV_CONFIG],
    },
  ],
  exports: [BullModule, QueueRegistry, WorkerLivenessRegistry],
})
export class BullMQModule {}
