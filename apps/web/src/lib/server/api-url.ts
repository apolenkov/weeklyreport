// No `server-only` import: next.config.ts loads this at Node config time.

export function requireApiUrl(): string {
  // An empty string counts as unset — an env file's `API_URL=` must fall
  // through to the public var, not produce an empty base URL.
  const url =
    nonEmpty(process.env.API_URL) ?? nonEmpty(process.env.NEXT_PUBLIC_API_URL);
  if (url === undefined) {
    throw new Error(
      "API base URL is not configured — set API_URL (server-side) or NEXT_PUBLIC_API_URL.",
    );
  }
  return url;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

interface TrpcBatchEntry {
  readonly result?: { readonly data?: unknown };
  readonly error?: { readonly message?: string };
}

interface SuperJsonEnvelope {
  readonly json: unknown;
  readonly meta?: unknown;
}

function isSuperJsonEnvelope(value: unknown): value is SuperJsonEnvelope {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value);
  return (
    Object.hasOwn(value, "json") &&
    keys.every((key) => key === "json" || key === "meta")
  );
}

// tRPC v11 batched GET empty-input map for procedures with no args.
export const TRPC_BATCH_EMPTY_INPUT = encodeURIComponent('{"0":{}}');

// Superjson contract is `{ json, meta? }`; non-matching payloads pass through
// so untransformed responses still decode and domain `json` fields are not unwrapped.
export function decodeTrpcBatchPayload(body: unknown): unknown {
  if (!Array.isArray(body) || body.length === 0) return null;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return null;
  const data = entry.result?.data;
  if (data === null || data === undefined) return null;
  return isSuperJsonEnvelope(data) ? (data.json ?? null) : data;
}

export function shouldUseDevAuthFallback(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DEV_MODE === "true" ||
      process.env.AUTH_DEV_MODE_ALLOW_TEST === "true")
  );
}
