"use client";

import { TRPCClientError } from "@trpc/client";

export type ClientErrorContext = Readonly<Record<string, unknown>>;

export type ClientErrorDetails = Readonly<{
  requestId: string | null;
  httpStatus: number | null;
  trpcCode: string | null;
  isInternal: boolean;
  /**
   * Any deterministic client-side error (HTTP 4xx). Retrying it cannot succeed,
   * so the query client skips retries for it. Broader than
   * {@link ClientErrorDetails.isInvalidLink}: covers 401/403/429 too.
   */
  isDeterministicClientError: boolean;
  /**
   * A malformed-input (`BAD_REQUEST` / Zod / HTTP 400) or not-found
   * (`NOT_FOUND` / HTTP 404) error. Its `error.message` (often a serialized Zod
   * issues array with the UUID `pattern` regex) MUST be replaced by a clean
   * "invalid link / not found" message and MUST NOT be echoed to the user.
   * Narrower than {@link ClientErrorDetails.isDeterministicClientError}: a
   * 401/403/429 keeps its own message.
   */
  isInvalidLink: boolean;
}>;

/** Lowest HTTP status treated as a deterministic client error. */
const CLIENT_ERROR_STATUS_MIN = 400;
/** HTTP status for a malformed request (Zod validation failure). */
const HTTP_BAD_REQUEST = 400;
/** HTTP status for a missing resource. */
const HTTP_NOT_FOUND = 404;
/** Lowest HTTP status treated as a transient/internal server error. */
const SERVER_ERROR_STATUS_MIN = 500;
/** tRPC error codes that map to the clean invalid-link / not-found message. */
const INVALID_LINK_TRPC_CODES = new Set(["BAD_REQUEST", "NOT_FOUND"]);
/** HTTP statuses that map to the clean invalid-link / not-found message. */
const INVALID_LINK_HTTP_STATUSES = new Set([HTTP_BAD_REQUEST, HTTP_NOT_FOUND]);

function computeIsDeterministicClientError(
  httpStatus: number | null,
  trpcCode: string | null,
): boolean {
  const is4xxStatus =
    httpStatus !== null &&
    httpStatus >= CLIENT_ERROR_STATUS_MIN &&
    httpStatus < SERVER_ERROR_STATUS_MIN;
  const isClientCode =
    trpcCode !== null && INVALID_LINK_TRPC_CODES.has(trpcCode);
  return is4xxStatus || isClientCode;
}

function computeIsInvalidLink(
  httpStatus: number | null,
  trpcCode: string | null,
): boolean {
  const isInvalidStatus =
    httpStatus !== null && INVALID_LINK_HTTP_STATUSES.has(httpStatus);
  const isInvalidCode =
    trpcCode !== null && INVALID_LINK_TRPC_CODES.has(trpcCode);
  return isInvalidStatus || isInvalidCode;
}

export type ClientErrorLogEntry = Readonly<{
  event: string;
  message: string;
  name: string | null;
  context: ClientErrorContext;
}>;

function readResponseHeader(response: unknown, name: string): string | null {
  if (!response || typeof response !== "object") return null;
  const headers = (response as { headers?: unknown }).headers;
  if (!headers || typeof headers !== "object") return null;
  const get = (headers as { get?: unknown }).get;
  if (typeof get !== "function") return null;
  const value: unknown = get.call(headers, name);
  return typeof value === "string" && value.trim() ? value : null;
}

function readErrorData(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof TRPCClientError)) return null;
  const data: unknown = error.data;
  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : null;
}

export function getClientErrorDetails(error: unknown): ClientErrorDetails {
  const data = readErrorData(error);
  const meta =
    error instanceof TRPCClientError &&
    error.meta &&
    typeof error.meta === "object"
      ? error.meta
      : null;
  const requestIdFromShape =
    typeof data?.requestId === "string" ? data.requestId : null;
  const requestIdFromHeader = readResponseHeader(
    meta?.response,
    "x-request-id",
  );
  const httpStatus =
    typeof data?.httpStatus === "number" ? data.httpStatus : null;
  const trpcCode = typeof data?.code === "string" ? data.code : null;
  const requestId = requestIdFromShape ?? requestIdFromHeader;
  const message = error instanceof Error ? error.message : "";

  const isInternal =
    trpcCode === "INTERNAL_SERVER_ERROR" ||
    (httpStatus !== null && httpStatus >= SERVER_ERROR_STATUS_MIN) ||
    message === "Unexpected error";

  const isDeterministicClientError =
    !isInternal && computeIsDeterministicClientError(httpStatus, trpcCode);
  const isInvalidLink =
    !isInternal && computeIsInvalidLink(httpStatus, trpcCode);

  return {
    requestId,
    httpStatus,
    trpcCode,
    isInternal,
    isDeterministicClientError,
    isInvalidLink,
  };
}

/**
 * Clean human message shown for a deterministic client error (4xx / Zod
 * validation / not-found). Replaces the raw `error.message` (a serialized Zod
 * issues array) so the user never sees the validation `pattern` regex.
 */
const INVALID_LINK_MESSAGE =
  "This link is invalid or the report no longer exists.";

export function formatClientErrorMessage(
  prefix: string,
  error: unknown,
): string {
  const details = getClientErrorDetails(error);
  const ref = details.requestId ? ` Reference: ${details.requestId}.` : "";

  if (details.isInternal) {
    return `${prefix}.${ref}`;
  }

  // Validation / not-found errors carry a raw Zod issues array (with the UUID
  // `pattern` regex) in `error.message`; never echo it. Show a clean message.
  // Other 4xx (401/403/429) keep their own message and fall through.
  if (details.isInvalidLink) {
    return `${prefix}: ${INVALID_LINK_MESSAGE}${ref}`;
  }

  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}${ref}`;
  }

  return `${prefix}${ref}`;
}

export function buildClientErrorLogEntry(
  event: string,
  error: unknown,
  context: ClientErrorContext = {},
): ClientErrorLogEntry {
  const details = getClientErrorDetails(error);
  const enrichedContext = {
    ...context,
    ...(details.requestId ? { requestId: details.requestId } : {}),
    ...(details.httpStatus !== null ? { httpStatus: details.httpStatus } : {}),
    ...(details.trpcCode ? { trpcCode: details.trpcCode } : {}),
  };

  if (error instanceof Error) {
    return {
      event,
      message: error.message,
      name: error.name,
      context: enrichedContext,
    };
  }

  return {
    event,
    message: typeof error === "string" ? error : String(error),
    name: null,
    context: enrichedContext,
  };
}

export function logClientError(
  event: string,
  error: unknown,
  context: ClientErrorContext = {},
): void {
  const entry = buildClientErrorLogEntry(event, error, context);
  if (error instanceof Error) {
    console.error(`[${event}] ${entry.message}`, error, entry.context);
    return;
  }
  console.error(`[${event}] ${entry.message}`, entry.context);
}
