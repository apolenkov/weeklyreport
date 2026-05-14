// Phase 55 (UFB-056): Telegram outbound BullMQ worker — seeds-only.
//
// The worker consumes jobs of shape `{ chatId: string; text: string }` from
// the `telegram-outbound` queue (registered in BullMQModule) and dispatches
// them through the resolved TelegramAdapter. In Phase 55 the only producer
// is `admin.testTelegramSend`, which is admin-only and proves the wiring
// without needing a real bot.
//
// Worker shape mirrors EmailReminderProcessor (Phase 28-03) deliberately:
//   - raw `new Worker(...)` on OnModuleInit, not @Processor — works around
//     the @nestjs/bullmq 11 + NestJS 11 DiscoveryService DI bug.
//   - structured-JSON failure log on the `failed` event so the existing
//     log dashboard surfaces telegram-outbound errors uniformly.
// Retries are configured at job-enqueue time (`attempts: 3`) so the queue
// itself stays generic.

import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Worker, type Job } from "bullmq";

import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import { TELEGRAM_ADAPTER, type TelegramAdapter } from "./telegram.adapter.js";

/**
 * Job-data shape for `telegram-outbound`. Kept intentionally minimal — the
 * adapter is the only consumer, and the queue does not carry rendering
 * concerns (a future producer that wants templating renders before enqueue).
 */
export type TelegramOutboundJobData = {
  chatId: string;
  text: string;
};

export const TELEGRAM_OUTBOUND_QUEUE_NAME = "telegram-outbound" as const;

/**
 * Default BullMQ job options used by every enqueue path. Centralised here
 * so producers don't drift on retry policy. `attempts: 3` matches the
 * `EmailReminderProcessor` family; `backoff` is exponential with a 5s
 * floor so a transient Telegram 429 has room to settle.
 */
export const TELEGRAM_OUTBOUND_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

@Injectable()
export class TelegramProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<TelegramOutboundJobData> | undefined;

  constructor(
    @Inject(TELEGRAM_ADAPTER) private readonly adapter: TelegramAdapter,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<TelegramOutboundJobData>(
      TELEGRAM_OUTBOUND_QUEUE_NAME,
      async (job: Job<TelegramOutboundJobData>) => {
        await this.processJob(job);
      },
      {
        ...getBullMQOptions(),
        // Modest concurrency — Telegram per-bot rate limit is 30 msg/s in
        // private chats; seeds-only path only sees admin smoke tests, so
        // 2 in-flight is plenty.
        concurrency: 2,
      },
    );

    this.worker.on("failed", (job, error) => {
      process.stderr.write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "telegram-outbound job failed",
          chatId: job?.data.chatId,
          attempt: job?.attemptsMade,
          error: error.message,
        }) + "\n",
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<TelegramOutboundJobData>): Promise<void> {
    const { chatId, text } = job.data;
    const result = await this.adapter.send(chatId, text);
    if (!result.ok) {
      // Surface as job error so BullMQ retry logic kicks in. The adapter
      // is responsible for honouring rate-limits internally; reaching this
      // branch means an unrecoverable provider rejection.
      throw new Error(`telegram adapter rejected send for chat ${chatId}`);
    }
  }
}
