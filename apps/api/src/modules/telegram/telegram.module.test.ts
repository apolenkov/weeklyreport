import { describe, expect, it } from "vitest";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { MockTelegramAdapter } from "./mock-telegram.adapter";
import { TELEGRAM_ADAPTER } from "./telegram.adapter";
import { selectTelegramAdapter } from "./telegram.module";

const envWithToken = (TG_BOT_TOKEN?: string): EnvConfig =>
  ({ TG_BOT_TOKEN }) as EnvConfig;

describe("selectTelegramAdapter", () => {
  it("returns MockTelegramAdapter when TG_BOT_TOKEN is unset", () => {
    const adapter = selectTelegramAdapter(envWithToken(undefined));
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("returns MockTelegramAdapter when TG_BOT_TOKEN is empty string", () => {
    const adapter = selectTelegramAdapter(envWithToken(""));
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("returns MockTelegramAdapter when TG_BOT_TOKEN is whitespace-only", () => {
    const adapter = selectTelegramAdapter(envWithToken(" ".repeat(3)));
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("throws when TG_BOT_TOKEN is set (real adapter not yet implemented)", () => {
    expect(() =>
      selectTelegramAdapter(envWithToken("1234:fake-token")),
    ).toThrow(/telegram bot not configured/i);
  });
});

describe("TELEGRAM_ADAPTER token", () => {
  it("is a symbol so Nest binds the interface without string collisions", () => {
    expect(typeof TELEGRAM_ADAPTER).toBe("symbol");
  });
});
