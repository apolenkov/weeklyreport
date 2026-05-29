// Phase 31 (AI-01/02/03): Anthropic SDK wrapper.
// - Lazy singleton: client constructed on first call so missing
//   ANTHROPIC_API_KEY does not break module load (CI without the key).
// - Structured output via Zod-driven JSON Schema (Zod 4 z.toJSONSchema).
// - System prompt cache_control: 'ephemeral' to leverage the 5-minute
//   prompt cache when the rubric is ≥1024 tokens (AI-SPEC §1).
// - All SDK errors are normalised to AiUnavailableError so callers have
//   one catch-target.
import Anthropic from "@anthropic-ai/sdk";
import { type ZodType, z } from "zod";

export class AiUnavailableError extends Error {
  public readonly underlying?: unknown;
  constructor(message: string, underlying?: unknown) {
    super(message);
    this.name = "AiUnavailableError";
    this.underlying = underlying;
  }
}

export class AiRateLimitError extends Error {
  public readonly underlying?: unknown;
  constructor(message: string, underlying?: unknown) {
    super(message);
    this.name = "AiRateLimitError";
    this.underlying = underlying;
  }
}

export type AnthropicUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export type RunStructuredOptions<S extends ZodType> = {
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: S;
  maxTokens?: number;
};

export type RunStructuredResult<R> = {
  result: R;
  usage: AnthropicUsage;
};

/**
 * AnthropicClientFactory — exposed for test injection. The default factory
 * lazily constructs a real client; tests vi.mock the SDK module entirely.
 */
export type AnthropicClientFactory = () => Anthropic;

let _cachedClient: Anthropic | null = null;
const defaultFactory: AnthropicClientFactory = () => {
  if (!_cachedClient) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
    }
    _cachedClient = new Anthropic({ apiKey });
  }
  return _cachedClient;
};

/**
 * Visible for tests — clear the cached client between unit tests so env
 * mutations are picked up.
 */
export function _resetAiClientForTests(): void {
  _cachedClient = null;
}

/**
 * Run a single-shot structured-output call. Forces Claude to emit a
 * tool-use block matching the Zod schema; parses + returns the result.
 */
export async function runStructured<S extends ZodType>(
  opts: RunStructuredOptions<S>,
  factory: AnthropicClientFactory = defaultFactory,
): Promise<RunStructuredResult<z.infer<S>>> {
  let client: Anthropic;
  try {
    client = factory();
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError("Failed to construct Anthropic client", err);
  }

  // Zod 4 native JSON Schema export.
  const inputSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;

  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.user }],
      tools: [
        {
          name: opts.toolName,
          description: opts.toolDescription,
          input_schema: inputSchema as never,
        },
      ],
      tool_choice: { type: "tool", name: opts.toolName },
    });
  } catch (err) {
    // Normalise SDK errors. RateLimitError and APIError have name fields.
    const name = (err as { name?: string } | null)?.name ?? "";
    if (name === "RateLimitError") {
      throw new AiRateLimitError("Anthropic rate-limit hit", err);
    }
    throw new AiUnavailableError(
      `Anthropic request failed: ${(err as Error).message}`,
      err,
    );
  }

  // streaming response objects don't have content. We only run non-stream.
  const blocks = (response as { content: Array<{ type: string }> }).content;
  const toolBlock = blocks.find((b) => b.type === "tool_use") as
    | { type: "tool_use"; input: unknown }
    | undefined;
  if (!toolBlock) {
    throw new AiUnavailableError("Anthropic response missing tool_use block");
  }
  const parsed = opts.schema.safeParse(toolBlock.input);
  if (!parsed.success) {
    throw new AiUnavailableError(
      `Anthropic tool output failed Zod parse: ${parsed.error.message}`,
    );
  }

  const usage = extractUsage(
    (response as unknown as { usage?: Record<string, number> }).usage ?? {},
  );

  return { result: parsed.data, usage };
}

export function extractUsage(raw: Record<string, number>): AnthropicUsage {
  return {
    inputTokens: Number(raw["input_tokens"] ?? 0),
    outputTokens: Number(raw["output_tokens"] ?? 0),
    cacheCreationTokens: Number(raw["cache_creation_input_tokens"] ?? 0),
    cacheReadTokens: Number(raw["cache_read_input_tokens"] ?? 0),
  };
}
