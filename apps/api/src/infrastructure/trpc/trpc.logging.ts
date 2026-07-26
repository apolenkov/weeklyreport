import { MS_PER_SECOND, type Role } from "@customreport/shared";
import type { TRPCError } from "@trpc/server";

import { httpRequestDurationSeconds } from "../metrics/metrics.registry.js";
import type { TrpcContext } from "./trpc.context.js";

type TrpcLogger = TrpcContext["logger"];

const TRPC_REQUEST_LOG_PHASE = "trpc.request";

const SLOW_TRPC_MS = 500;

const TRPC_ERROR_HTTP_STATUS: Record<string, string> = {
  BAD_REQUEST: "400",
  UNAUTHORIZED: "401",
  FORBIDDEN: "403",
  NOT_FOUND: "404",
  METHOD_NOT_SUPPORTED: "405",
  TIMEOUT: "408",
  CONFLICT: "409",
  PRECONDITION_FAILED: "412",
  PAYLOAD_TOO_LARGE: "413",
  UNPROCESSABLE_CONTENT: "422",
  TOO_MANY_REQUESTS: "429",
  CLIENT_CLOSED_REQUEST: "499",
  INTERNAL_SERVER_ERROR: "500",
};

// Compact response-shape descriptor for debug logs — keys/lengths only,
// never values (full JSON previously leaked PII on auth.me / admin.*).
function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array[0]";
    const inner = describeShape(value[0]);
    return `array[${value.length}]<${inner}>`;
  }
  if (typeof value === "object") {
    // eslint-disable-next-line sonarjs/no-alphabetical-sort -- deterministic key ordering for a debug shape string, not user-facing sort
    const keys = Object.keys(value).sort();
    return `object{${keys.join(",")}}`;
  }
  return typeof value;
}

// Surface real failure (Prisma/Zod) under the generic INTERNAL_SERVER_ERROR
// wrapper. Stack frames leak paths — only code/meta are logged.
export function deriveCauseInfo(cause: unknown) {
  if (!(cause instanceof Error)) return undefined;
  return {
    name: cause.constructor.name,
    message: cause.message,
    ...("code" in cause
      ? { causeCode: (cause as { code?: unknown }).code }
      : {}),
    ...("meta" in cause
      ? { causeMeta: (cause as { meta?: unknown }).meta }
      : {}),
  };
}

function observeTrpcDuration(
  identity: TrpcCallIdentity,
  statusCode: string,
  durationMs: number,
): void {
  httpRequestDurationSeconds.observe(
    {
      method: identity.type.toUpperCase(),
      route: `/trpc/${identity.procedure}`,
      status_code: statusCode,
    },
    durationMs / MS_PER_SECOND,
  );
}

// Caller identity repeated on the start/end pair so a log search on either
// end of a request returns the same fields.
export interface TrpcCallIdentity {
  readonly procedure: string;
  readonly type: string;
  readonly userId: string | null;
  readonly role: Role | null;
}

export function logRequestStart(
  logger: TrpcLogger,
  identity: TrpcCallIdentity,
): void {
  logger.info("trpc request start", {
    phase: TRPC_REQUEST_LOG_PHASE,
    stage: "start",
    ...identity,
  });
}

// Debug-level input breadcrumb. Log shape only, never raw values: report
// text, UUIDs, emails and admin edits can all appear in tRPC input.
export async function logInputBreadcrumb(
  logger: TrpcLogger,
  path: string,
  type: string,
  getRawInput: () => Promise<unknown>,
): Promise<void> {
  if (path === "auth.login" || path === "auth.refresh") return;
  try {
    const rawInput = await getRawInput();
    if (rawInput === undefined) return;
    logger.debug("trpc request input", {
      phase: TRPC_REQUEST_LOG_PHASE,
      stage: "input",
      procedure: path,
      type,
      inputShape: describeShape(rawInput),
    });
  } catch {
    // getRawInput() can throw on malformed bodies — the actual error will
    // still surface from next() below, so just skip the debug breadcrumb.
  }
}

export function recordTrpcSuccess(
  logger: TrpcLogger,
  identity: TrpcCallIdentity,
  duration: number,
  data: unknown,
): void {
  observeTrpcDuration(identity, "200", duration);

  if (duration > SLOW_TRPC_MS) {
    logger.warn("slow trpc procedure", {
      phase: TRPC_REQUEST_LOG_PHASE,
      stage: "slow",
      procedure: identity.procedure,
      type: identity.type,
      duration,
    });
  }
  logger.info("trpc request end", {
    phase: TRPC_REQUEST_LOG_PHASE,
    stage: "end",
    ...identity,
    duration,
    status: "success",
  });
  // Shape only (keys/lengths) — never values (PII leak risk).
  try {
    logger.debug("trpc request output", {
      phase: TRPC_REQUEST_LOG_PHASE,
      stage: "output",
      procedure: identity.procedure,
      type: identity.type,
      outputShape: describeShape(data),
    });
  } catch {
    // Non-introspectable result — skip the breadcrumb rather than throw.
  }
}

export function recordTrpcFailure(
  logger: TrpcLogger,
  identity: TrpcCallIdentity,
  duration: number,
  error: TRPCError,
): void {
  observeTrpcDuration(
    identity,
    TRPC_ERROR_HTTP_STATUS[error.code] ?? "500",
    duration,
  );

  const causeInfo = deriveCauseInfo(error.cause);

  logger.error("trpc request end", {
    phase: TRPC_REQUEST_LOG_PHASE,
    stage: "end",
    ...identity,
    duration,
    status: "error",
    error: {
      code: error.code,
      message: error.message,
      ...(causeInfo ? { cause: causeInfo } : {}),
    },
  });
}
