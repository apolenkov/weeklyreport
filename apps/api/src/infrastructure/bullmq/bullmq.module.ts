import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { BullBoardQueues } from "./bull-board.module.js";
import { getBullMQOptions } from "./bullmq-options";
import { DLQMonitorService } from "./dlq-monitor.service.js";

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
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV_CONFIG],
      useFactory: (env: EnvConfig) => getBullMQOptions(env),
    }),
    BullModule.registerQueue({ name: "pdf-export" }),
    BullModule.registerQueue({ name: "email-reminder" }),
    // UFB-056 / Phase 55-3: Telegram outbound queue. Seeds-only — no
    // producer enqueues to it yet beyond the admin test-send tRPC
    // procedure. Default job options keep payload visible in dev (a
    // BullMQ `attempts: 3` is set per-job at enqueue time, not on the
    // queue itself, so the test surface can stay synchronous).
    BullModule.registerQueue({ name: "telegram-outbound" }),
  ],
  providers: [
    {
      provide: DLQMonitorService,
      useFactory: (env: EnvConfig) => new DLQMonitorService(env),
      inject: [ENV_CONFIG],
    },
    {
      provide: BullBoardQueues,
      useFactory: (env: EnvConfig) => new BullBoardQueues(env),
      inject: [ENV_CONFIG],
    },
  ],
  exports: [BullModule, BullBoardQueues],
})
export class BullMQModule {}
