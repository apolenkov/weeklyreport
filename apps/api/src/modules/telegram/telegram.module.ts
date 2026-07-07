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

/**
 * Selects the Telegram adapter based on env.
 *
 *  - `TG_BOT_TOKEN` empty / unset → MockTelegramAdapter (the seeds-only
 *    default). Stores the payload on the in-process mock so admin smoke
 *    tests work without an active bot.
 *  - `TG_BOT_TOKEN` non-empty → throws at module construction. We
 *    deliberately fail loud rather than fall back to the mock — a token
 *    being present means the org expects real delivery, and a silent
 *    Mock would swallow notifications.
 *
 * The real provider (telegraf or grammY-backed adapter) will land in its
 * own file (`real-telegram.adapter.ts`) when the bot is activated;
 * at that point this switch grows a `if (token) return new RealAdapter()`
 * arm and the throw becomes unreachable.
 */
export function selectTelegramAdapter(env: EnvConfig): TelegramAdapter {
  if (!isTelegramConfigured(env)) {
    return new MockTelegramAdapter();
  }
  // TODO(Phase-55-activation): wire real bot adapter when TG_BOT_TOKEN is set.
  // Library candidates: telegraf (mature) or grammY (modern, smaller bundle).
  // Decision in .planning/phases/55-telegram/55-PHASE-SUMMARY.md "Open questions".
  // Activation also requires:
  //   - @BotFather token registered
  //   - user binding flow (/start <one-time-token>) implementation
  //   - /summary, /ask command handlers (RAG dependency)
  //
  // REGISTRATION DECISION:
  //   No standalone Telegram registration — users authenticate via SSO only
  //   (Keycloak/SAML). Telegram binding = linking an already-authenticated
  //   user's account to their chat_id via a one-time deep-link token.
  //   Google OAuth later as a second SSO provider (separate phase).
  // CLAUDE.md "TODO discipline" rule applies.
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
