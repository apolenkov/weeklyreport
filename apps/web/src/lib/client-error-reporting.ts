"use client";

import { TRPCClientError } from "@trpc/client";

export type ClientErrorContext = Readonly<Record<string, unknown>>;

export type ClientErrorDetails = Readonly<{
  requestId: string | null;
  httpStatus: number | null;
  trpcCode: string | null;
  isInternal: boolean;
}>;

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
  const value = get.call(headers, name);
  return typeof value === "string" && value.trim() ? value : null;
}

function readErrorData(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof TRPCClientError)) return null;
  const data = error.data;
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
      ? (error.meta as Record<string, unknown>)
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

  return {
    requestId,
    httpStatus,
    trpcCode,
    isInternal:
      trpcCode === "INTERNAL_SERVER_ERROR" ||
      (httpStatus !== null && httpStatus >= 500) ||
      message === "Unexpected error",
  };
}

export function formatClientErrorMessage(
  prefix: string,
  error: unknown,
): string {
  const details = getClientErrorDetails(error);
  const ref = details.requestId ? ` Reference: ${details.requestId}.` : "";

  if (details.isInternal) {
    return `${prefix}.${ref}`;
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
