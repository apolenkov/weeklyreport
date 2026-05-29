// Phase 31 (AI-01) — ai-client.ts unit tests. Mocks @anthropic-ai/sdk
// entirely so no live API calls happen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const messagesCreateMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  const RateLimitError = class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RateLimitError";
    }
  };
  class MockAnthropic {
    public messages = { create: messagesCreateMock };
    constructor(public readonly opts: { apiKey: string }) {}
  }
  return {
    default: MockAnthropic,
    RateLimitError,
  };
});

import {
  _resetAiClientForTests,
  AiRateLimitError,
  AiUnavailableError,
  extractUsage,
  runStructured,
} from "./ai-client.js";

const schema = z.object({ verdict: z.enum(["ok", "bad"]), reason: z.string() });

const ORIGINAL_KEY = process.env["ANTHROPIC_API_KEY"];

beforeEach(() => {
  _resetAiClientForTests();
  messagesCreateMock.mockReset();
  process.env["ANTHROPIC_API_KEY"] = "test-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env["ANTHROPIC_API_KEY"];
  else process.env["ANTHROPIC_API_KEY"] = ORIGINAL_KEY;
});

describe("runStructured", () => {
  it("passes ephemeral cache_control + tool_choice + JSON-schema input", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        { type: "tool_use", input: { verdict: "ok", reason: "looks fine" } },
      ],
      usage: {
        input_tokens: 1234,
        output_tokens: 56,
        cache_creation_input_tokens: 1024,
        cache_read_input_tokens: 0,
      },
    });

    const r = await runStructured({
      model: "claude-haiku-4-5-20251001",
      system: "rubric goes here, padded long",
      user: "short user prompt",
      toolName: "record_x",
      toolDescription: "Record x",
      schema,
    });

    expect(r.result).toEqual({ verdict: "ok", reason: "looks fine" });
    expect(r.usage).toEqual({
      inputTokens: 1234,
      outputTokens: 56,
      cacheCreationTokens: 1024,
      cacheReadTokens: 0,
    });

    const arg = messagesCreateMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(arg).toBeDefined();
    expect(arg["model"]).toBe("claude-haiku-4-5-20251001");
    expect(arg["tool_choice"]).toEqual({ type: "tool", name: "record_x" });
    const systemArr = arg["system"] as Array<{
      cache_control: { type: string };
    }>;
    expect(systemArr[0]?.cache_control).toEqual({ type: "ephemeral" });
    const tools = arg["tools"] as Array<{
      name: string;
      input_schema: { type: string };
    }>;
    expect(tools[0]?.name).toBe("record_x");
    expect(tools[0]?.input_schema?.type).toBe("object");
  });

  it("rejects malformed tool_use input via Zod", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: "tool_use", input: { verdict: "WAT", reason: "bad" } }],
      usage: {},
    });

    await expect(
      runStructured({
        model: "claude-haiku-4-5-20251001",
        system: "r",
        user: "u",
        toolName: "t",
        toolDescription: "d",
        schema,
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("throws AiUnavailableError when no tool_use block present", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "fluffy refusal" }],
      usage: {},
    });

    await expect(
      runStructured({
        model: "claude-haiku-4-5-20251001",
        system: "r",
        user: "u",
        toolName: "t",
        toolDescription: "d",
        schema,
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("maps RateLimitError → AiRateLimitError", async () => {
    const err = new Error("429") as Error & { name: string };
    err.name = "RateLimitError";
    messagesCreateMock.mockRejectedValueOnce(err);

    await expect(
      runStructured({
        model: "claude-haiku-4-5-20251001",
        system: "r",
        user: "u",
        toolName: "t",
        toolDescription: "d",
        schema,
      }),
    ).rejects.toBeInstanceOf(AiRateLimitError);
  });

  it("throws AiUnavailableError when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env["ANTHROPIC_API_KEY"];
    _resetAiClientForTests();
    await expect(
      runStructured({
        model: "claude-haiku-4-5-20251001",
        system: "r",
        user: "u",
        toolName: "t",
        toolDescription: "d",
        schema,
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe("extractUsage", () => {
  it("handles missing fields with zeros", () => {
    expect(extractUsage({})).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
  });
});
