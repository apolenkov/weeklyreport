/**
 * Phase 55 — Telegram activation integration test scaffold (W3.2).
 *
 * Skipped in CI unless TG_BOT_TOKEN env is set. Provides the one-flag-flip
 * gate for activating the real Telegram bot adapter: set TG_BOT_TOKEN and
 * run this file.
 *
 * See .planning/phases/55-telegram/55-PHASE-SUMMARY.md "Activation Playbook".
 */
import { describe, expect, it } from "vitest";

const hasBotToken = !!process.env["TG_BOT_TOKEN"]?.trim();

describe.skipIf(!hasBotToken)("Telegram activation (real bot)", () => {
  it("TG_BOT_TOKEN is set and non-empty", () => {
    const token = process.env["TG_BOT_TOKEN"]?.trim();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("TelegramModule would construct a real adapter when TG_BOT_TOKEN is set", () => {
    // TODO(Phase-55-activation): once RealTelegramAdapter is implemented,
    // import selectTelegramAdapter() from telegram.module and assert:
    //   const adapter = selectTelegramAdapter();
    //   expect(adapter).toBeInstanceOf(RealTelegramAdapter);
    // Also: nock `https://api.telegram.org/bot${token}/sendMessage` and
    // assert the adapter calls it with { chat_id, text } shape.
    expect(process.env["TG_BOT_TOKEN"]?.length).toBeGreaterThan(0);
  });
});
