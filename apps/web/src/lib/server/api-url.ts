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

// Unwraps a tRPC v11 batched GET response body to the first entry's payload;
// tolerates both the superjson `{ json }` wrapper and the un-transformed
// shape (resilience against transformer config drift).
export function decodeTrpcBatchPayload(body: unknown): unknown {
  if (!Array.isArray(body) || body.length === 0) return null;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return null;
  const data = entry.result?.data;
  if (data === null || data === undefined) return null;
  if (typeof data === "object" && "json" in (data as Record<string, unknown>)) {
    return (data as { json: unknown }).json ?? null;
  }
  return data;
}

export function shouldUseDevAuthFallback(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DEV_MODE === "true" ||
      process.env.AUTH_DEV_MODE_ALLOW_TEST === "true")
  );
}
