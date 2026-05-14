// Phase 55 (UFB-056): MockTelegramAdapter — deterministic stub used until
// the org activates a real Telegram bot. Logs the payload to stderr as a
// structured JSON line (so it shows up in the API log stream just like a
// real BullMQ worker event) and always returns `{ ok: true }`.
//
// Determinism is the point: no network, no `bigint` parsing, no rate-limit
// state. Tests inject this adapter through the DI token and assert against
// the recorded `lastPayload` rather than parsing stderr.

import { Injectable } from "@nestjs/common";

import { telegramMessageSentTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type {
  TelegramAdapter,
  TelegramSendResult,
} from "./telegram.adapter.js";

@Injectable()
export class MockTelegramAdapter implements TelegramAdapter {
  /**
   * Test hook — most-recent send payload. Tests use this to assert the
   * queue worker dispatched the right message without parsing structured
   * log lines. Production callers ignore this field; it is intentionally
   * mutable so the mock stays cheap (no event-emitter, no promise queue).
   */
  public lastPayload: { chatId: string; text: string } | null = null;

  /**
   * Returns `{ ok: true }` unconditionally. Logs a single JSON line to
   * stderr so a developer running the API container can see that the
   * payload reached the worker. The format matches
   * `email-reminder.processor.ts` so existing log dashboards stay
   * uniform.
   */
  async send(chatId: string, text: string): Promise<TelegramSendResult> {
    this.lastPayload = { chatId, text };
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "telegram-outbound mock send",
        chatId,
        textLength: text.length,
      }) + "\n",
    );
    telegramMessageSentTotal.inc({ status: "ok" });
    return { ok: true };
  }
}
