// No `server-only` import: next.config.ts loads this at Node config time.

import { z } from "zod";

const apiUrlSchema = z
  .url({ protocol: /^https?$/ })
  .refine((value) => /^https?:\/\//i.test(value))
  .transform((value) => new URL(value))
  .refine((url) => !url.username && !url.password && !url.search && !url.hash);

export function requireApiUrl(): string {
  const result = apiUrlSchema.safeParse(process.env.API_URL);
  if (!result.success) {
    throw new Error(
      "Invalid API_URL — set an absolute HTTP(S) base URL without credentials, query or fragment (server-side).",
    );
  }
  const url = result.data;
  const segments = url.pathname.split("/");
  const path = segments
    .slice(0, segments.findLastIndex((segment) => segment !== "") + 1)
    .join("/");
  return `${url.origin}${path}`;
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

// Explicit deadline for server-side calls to the API and proxy routes; the
// runtime default is 300 s, long enough to pile up blocked SSR requests.
export const SERVER_FETCH_TIMEOUT_MS = 10_000;

// tRPC v11 batched GET empty-input map for procedures with no args.
export const TRPC_BATCH_EMPTY_INPUT = encodeURIComponent('{"0":{}}');

// Superjson is configured on both sides of the tRPC transport. Rejecting any
// other shape keeps configuration drift from becoming an undocumented wire
// contract.
export function decodeTrpcBatchPayload(body: unknown): unknown {
  if (!Array.isArray(body) || body.length === 0) return null;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return null;
  const data = entry.result?.data;
  if (data === null || data === undefined) return null;
  return isSuperJsonEnvelope(data) ? (data.json ?? null) : null;
}

export function shouldUseDevAuthFallback(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DEV_MODE === "true" ||
      process.env.AUTH_DEV_MODE_ALLOW_TEST === "true")
  );
}
