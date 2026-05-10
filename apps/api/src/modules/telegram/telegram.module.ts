import { Module } from '@nestjs/common';

import { MockTelegramAdapter } from './mock-telegram.adapter.js';
import { TELEGRAM_ADAPTER, type TelegramAdapter } from './telegram.adapter.js';
import { TelegramProcessor } from './telegram.queue.js';

/**
 * Phase 55 (UFB-056): selects the Telegram adapter based on env.
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
 * own file (`real-telegram.adapter.ts`) when Phase 55+ activates the bot;
 * at that point this switch grows a `if (token) return new RealAdapter()`
 * arm and the throw becomes unreachable.
 */
export function selectTelegramAdapter(): TelegramAdapter {
  const token = process.env['TG_BOT_TOKEN']?.trim() ?? '';
  if (token === '') {
    return new MockTelegramAdapter();
  }
  throw new Error('Telegram bot not configured');
}

@Module({
  // BullMQModule is registered globally in AppModule; this module imports
  // nothing here because the queue handle is consumed via DI elsewhere
  // (the tRPC router gets a `Queue` instance through `getQueueToken`).
  providers: [
    {
      provide: TELEGRAM_ADAPTER,
      useFactory: () => selectTelegramAdapter(),
    },
    TelegramProcessor,
  ],
  exports: [TELEGRAM_ADAPTER],
})
export class TelegramModule {}
