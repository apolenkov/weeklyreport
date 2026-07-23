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

// The API's initTRPC transformer is superjson, whose serialized contract is
// exactly `{ json, meta? }`; domain payload fields remain nested under `json`.
// A payload that does not match that precise shape is passed through as-is —
// the config-drift fallback callers pin (an untransformed response must still
// decode), which also keeps a domain object carrying its own `json` field
// from being mis-unwrapped.
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
