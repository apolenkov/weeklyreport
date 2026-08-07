import type { ChatCompletionResponse } from "@mistralai/mistralai/models/components";
import { describe, expect, it, vi } from "vitest";

import type { MistralChatClient } from "./mistral-planner.adapter.js";
import {
  MistralPlannerAdapter,
  MistralProtocolError,
  MistralProviderError,
} from "./mistral-planner.adapter.js";

const config = {
  apiKey: "test-only-placeholder",
  server: "eu",
  model: "mistral-medium-3-5",
  maxTokens: 256,
  providerTimeoutMs: 5000,
} as const;

const plannerInput = {
  question: "Which risks are overdue?",
  now: new Date("2026-08-04T12:00:00.000Z"),
  timeZone: "UTC",
} as const;

const responseWithArguments = (
  argumentsValue: string | Record<string, unknown>,
): ChatCompletionResponse => ({
  id: "completion-id",
  object: "chat.completion",
  model: config.model,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  created: 1,
  choices: [
    {
      index: 0,
      finishReason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "tool-call-id",
            type: "function",
            index: 0,
            function: {
              name: "search_report_entries",
              arguments: argumentsValue,
            },
          },
        ],
      },
    },
  ],
});

const fakeClient = (response: ChatCompletionResponse) => {
  const complete = vi
    .fn<MistralChatClient["complete"]>()
    .mockResolvedValue(response);
  return { client: { complete } satisfies MistralChatClient, complete };
};

describe("MistralPlannerAdapter", () => {
  it("uses one strict tool call with bounded request timeout", async () => {
    const { client, complete } = fakeClient(
      responseWithArguments({ retrieval: "structured" }),
    );
    const adapter = new MistralPlannerAdapter(client, config);

    await expect(adapter.plan(plannerInput)).resolves.toEqual({
      retrieval: "structured",
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: config.model,
        maxTokens: config.maxTokens,
        toolChoice: {
          type: "function",
          function: { name: "search_report_entries" },
        },
        parallelToolCalls: false,
      }),
      { timeoutMs: config.providerTimeoutMs },
    );
    const request = complete.mock.calls[0]?.[0];
    const tool = request?.tools?.[0];
    expect(tool?.type).toBe("function");
    if (tool?.type === "function") {
      expect(tool.function.name).toBe("search_report_entries");
      expect(tool.function.strict).toBe(true);
    }
  });

  it("supports a separate repair request through the same tool contract", async () => {
    const { client, complete } = fakeClient(
      responseWithArguments({ repaired: true }),
    );
    const adapter = new MistralPlannerAdapter(client, config);

    await expect(
      adapter.repairPlan({
        original: plannerInput,
        previousArguments: { broken: true },
        issues: [{ path: ["retrieval"], code: "invalid_value" }],
      }),
    ).resolves.toEqual({ repaired: true });
    const request = complete.mock.calls[0]?.[0];
    expect(request?.messages[0]).toMatchObject({ role: "system" });
    expect(request?.messages[0]?.content).toContain("failed server validation");
  });

  it("fails closed on malformed or missing tool calls and wraps transport errors", async () => {
    const { client: malformedClient } = fakeClient(
      responseWithArguments("not-json"),
    );
    const malformed = new MistralPlannerAdapter(malformedClient, config);
    await expect(malformed.plan(plannerInput)).rejects.toBeInstanceOf(
      MistralProtocolError,
    );

    const failingClient: MistralChatClient = {
      complete: vi.fn().mockRejectedValue(new Error("network")),
    };
    const failing = new MistralPlannerAdapter(failingClient, config);
    await expect(failing.plan(plannerInput)).rejects.toBeInstanceOf(
      MistralProviderError,
    );
  });

  it.each([
    [429, true],
    [503, true],
    [401, false],
  ] as const)(
    "classifies provider status %s retryable=%s",
    async (statusCode, retryable) => {
      const client: MistralChatClient = {
        complete: vi.fn().mockRejectedValue({ statusCode }),
      };
      const adapter = new MistralPlannerAdapter(client, config);

      const error = await adapter
        .plan(plannerInput)
        .catch((error_: unknown) => Promise.resolve(error_));

      expect(error).toMatchObject({ statusCode, retryable });
    },
  );
});
