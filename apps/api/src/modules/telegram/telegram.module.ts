import { Module } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import { createWorkerLogger } from "../../infrastructure/bullmq/worker-observability.js";
import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { isTelegramConfigured } from "../../lib/env.js";
import { MockTelegramAdapter } from "./mock-telegram.adapter.js";
import { TELEGRAM_ADAPTER, type TelegramAdapter } from "./telegram.adapter.js";
import { TelegramProcessor } from "./telegram.queue.js";

// Token unset → mock. Token set → fail loud (never silent-mock real delivery).
export function selectTelegramAdapter(env: EnvConfig): TelegramAdapter {
  if (!isTelegramConfigured(env)) {
    return new MockTelegramAdapter();
  }
  throw new Error(
    "Not implemented — see TODO(Phase-55-activation). Telegram bot not configured: TG_BOT_TOKEN set but no real adapter.",
  );
}

@Module({
  // ConfigModule supplies ENV_CONFIG for the processor's Redis connection.
  // BullMQModule is registered globally in AppModule; the queue handle is
  // consumed via DI elsewhere (the tRPC router gets a `Queue` instance
  // through `getQueueToken`).
  imports: [ConfigModule],
  providers: [
    {
      provide: TELEGRAM_ADAPTER,
      useFactory: (env: EnvConfig) => selectTelegramAdapter(env),
      inject: [ENV_CONFIG],
    },
    {
      provide: TelegramProcessor,
      useFactory: (adapter: TelegramAdapter, env: EnvConfig, cls: ClsService) =>
        new TelegramProcessor(
          adapter,
          env,
          createWorkerLogger("telegram-outbound-worker", cls),
          cls,
        ),
      inject: [TELEGRAM_ADAPTER, ENV_CONFIG, ClsService],
    },
  ],
  exports: [TELEGRAM_ADAPTER],
})
export class TelegramModule {}
