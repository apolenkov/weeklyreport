// Deterministic stub until a real bot is activated: no network/rate-limit.
// Tests assert against lastPayload rather than parsing stderr.

import { Injectable } from "@nestjs/common";

import { telegramMessageSentTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type {
  TelegramAdapter,
  TelegramSendResult,
} from "./telegram.adapter.js";

@Injectable()
export class MockTelegramAdapter implements TelegramAdapter {
  // Test hook for last send; production callers ignore it.
  public lastPayload: { chatId: string; text: string } | null = null;

  // Log format matches email-reminder.processor.ts so dashboards stay uniform.
  send(chatId: string, text: string): Promise<TelegramSendResult> {
    this.lastPayload = { chatId, text };
    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "telegram-outbound mock send",
        chatId,
        textLength: text.length,
      })}\n`,
    );
    telegramMessageSentTotal.inc({ status: "ok" });
    return Promise.resolve({ ok: true });
  }
}
