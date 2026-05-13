import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MockTelegramAdapter } from "../mock-telegram.adapter";
import { selectTelegramAdapter } from "../telegram.module";

describe("selectTelegramAdapter (Phase 55 / UFB-056)", () => {
  const originalToken = process.env["TG_BOT_TOKEN"];

  beforeEach(() => {
    delete process.env["TG_BOT_TOKEN"];
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env["TG_BOT_TOKEN"];
    } else {
      process.env["TG_BOT_TOKEN"] = originalToken;
    }
  });

  it("returns MockTelegramAdapter when TG_BOT_TOKEN is unset", () => {
    const adapter = selectTelegramAdapter();
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("returns MockTelegramAdapter when TG_BOT_TOKEN is empty string", () => {
    process.env["TG_BOT_TOKEN"] = "";
    const adapter = selectTelegramAdapter();
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("returns MockTelegramAdapter when TG_BOT_TOKEN is whitespace-only", () => {
    process.env["TG_BOT_TOKEN"] = "   ";
    const adapter = selectTelegramAdapter();
    expect(adapter).toBeInstanceOf(MockTelegramAdapter);
  });

  it("throws when TG_BOT_TOKEN is set (real adapter not yet implemented)", () => {
    process.env["TG_BOT_TOKEN"] = "1234:fake-token";
    expect(() => selectTelegramAdapter()).toThrow(
      /telegram bot not configured/i,
    );
  });
});
