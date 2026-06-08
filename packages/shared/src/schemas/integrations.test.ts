import { describe, expect, it } from "vitest";

import {
  adminTestTelegramSendSchema,
  integrationsStatusSchema,
  telegramIntegrationStatusSchema,
} from "./integrations";

describe("telegramIntegrationStatusSchema (Phase 55 / UFB-056)", () => {
  it("accepts the off-state (no token, no bindings)", () => {
    expect(
      telegramIntegrationStatusSchema.safeParse({
        configured: false,
        bindings: 0,
      }).success,
    ).toBe(true);
  });

  it("accepts the on-state (token + bindings)", () => {
    expect(
      telegramIntegrationStatusSchema.safeParse({
        configured: true,
        bindings: 12,
      }).success,
    ).toBe(true);
  });

  it("rejects fractional bindings", () => {
    expect(
      telegramIntegrationStatusSchema.safeParse({
        configured: true,
        bindings: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects negative bindings count", () => {
    expect(
      telegramIntegrationStatusSchema.safeParse({
        configured: true,
        bindings: -1,
      }).success,
    ).toBe(false);
  });
});

describe("integrationsStatusSchema", () => {
  it("wraps the telegram status under a `telegram` key", () => {
    const parsed = integrationsStatusSchema.parse({
      telegram: { configured: false, bindings: 0 },
    });
    expect(parsed.telegram.configured).toBe(false);
    expect(parsed.telegram.bindings).toBe(0);
  });

  it("rejects payload missing the telegram envelope", () => {
    expect(
      integrationsStatusSchema.safeParse({
        bindings: 0,
        configured: false,
      }).success,
    ).toBe(false);
  });
});

describe("adminTestTelegramSendSchema", () => {
  it("accepts a numeric-looking chatId as a string", () => {
    const result = adminTestTelegramSendSchema.safeParse({
      chatId: "123456789",
      text: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a negative-prefixed group chat id", () => {
    const result = adminTestTelegramSendSchema.safeParse({
      chatId: "-1001234567890",
      text: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace around chatId and text", () => {
    const result = adminTestTelegramSendSchema.parse({
      chatId: "  123  ",
      text: "  body  ",
    });
    expect(result.chatId).toBe("123");
    expect(result.text).toBe("body");
  });

  it("rejects empty chatId after trimming", () => {
    expect(
      adminTestTelegramSendSchema.safeParse({
        chatId: " ".repeat(3),
        text: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects empty text after trimming", () => {
    expect(
      adminTestTelegramSendSchema.safeParse({
        chatId: "1",
        text: " ".repeat(3),
      }).success,
    ).toBe(false);
  });

  it("rejects text longer than the Telegram 4096-char cap", () => {
    expect(
      adminTestTelegramSendSchema.safeParse({
        chatId: "1",
        text: "x".repeat(4097),
      }).success,
    ).toBe(false);
  });
});
