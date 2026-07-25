import {
  MS_PER_SECOND,
  type Role,
  type UserSession,
} from "@customreport/shared";
import { assertRole } from "@customreport/shared/trpc";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { httpRequestDurationSeconds } from "../metrics/metrics.registry.js";
import { trpcMetricsMiddleware as recordTrpcMetrics } from "../metrics/trpc-metrics.middleware.js";
import type { TrpcContext } from "./trpc.context.js";

const TRPC_REQUEST_LOG_PHASE = "trpc.request";

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

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, ctx }) {
    const {
      stack: _stack,
      cause: _cause,
      ...safeData
    } = shape.data as Record<string, unknown>;
    return {
      ...shape,
      data: {
        ...safeData,
        requestId: ctx?.correlationId ?? "no-context",
      },
    };
  },
});

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
  type: string,
  path: string,
  statusCode: string,
  durationMs: number,
) {
  httpRequestDurationSeconds.observe(
    {
      method: type.toUpperCase(),
      route: `/trpc/${path}`,
      status_code: statusCode,
    },
    durationMs / MS_PER_SECOND,
  );
}

// Before loggingMiddleware so timings exclude logger/audit overhead.
// Histogram emit lives in metrics/trpc-metrics.middleware.ts (framework-agnostic).
export const metricsMiddleware = t.middleware(({ path, type, next }) =>
  recordTrpcMetrics({ path, type, next }),
);

// Before auth so failed-auth attempts are still recorded (forensics).
export const loggingMiddleware = t.middleware(
  async ({ ctx, next, path, type, getRawInput }) => {
    const start = performance.now();
    const userId = ctx.session?.userId ?? null;
    const role = ctx.session?.role ?? null;

    ctx.logger.info("trpc request start", {
      phase: TRPC_REQUEST_LOG_PHASE,
      stage: "start",
      procedure: path,
      type,
      userId,
      role,
    });

    // Debug-level input breadcrumb. Log shape only, never raw values: report
    // text, UUIDs, emails and admin edits can all appear in tRPC input.
    if (path !== "auth.login" && path !== "auth.refresh") {
      try {
        const rawInput = await getRawInput();
        if (rawInput !== undefined) {
          ctx.logger.debug("trpc request input", {
            phase: TRPC_REQUEST_LOG_PHASE,
            stage: "input",
            procedure: path,
            type,
            inputShape: describeShape(rawInput),
          });
        }
      } catch {
        // getRawInput() can throw on malformed bodies — the actual error will
        // still surface from next() below, so just skip the debug breadcrumb.
      }
    }

    const result = await next();
    const duration = Math.round(performance.now() - start);

    if (result.ok) {
      observeTrpcDuration(type, path, "200", duration);
      if (duration > SLOW_TRPC_MS) {
        ctx.logger.warn("slow trpc procedure", {
          phase: TRPC_REQUEST_LOG_PHASE,
          stage: "slow",
          procedure: path,
          type,
          duration,
        });
      }
      ctx.logger.info("trpc request end", {
        phase: TRPC_REQUEST_LOG_PHASE,
        stage: "end",
        procedure: path,
        type,
        userId,
        role,
        duration,
        status: "success",
      });
      // Shape only (keys/lengths) — never values (PII leak risk).
      try {
        ctx.logger.debug("trpc request output", {
          phase: TRPC_REQUEST_LOG_PHASE,
          stage: "output",
          procedure: path,
          type,
          outputShape: describeShape(result.data),
        });
      } catch {
        // Non-introspectable result — skip the breadcrumb rather than throw.
      }
    } else {
      observeTrpcDuration(
        type,
        path,
        TRPC_ERROR_HTTP_STATUS[result.error.code] ?? "500",
        duration,
      );
      const causeInfo = deriveCauseInfo(result.error.cause);

      ctx.logger.error("trpc request end", {
        phase: TRPC_REQUEST_LOG_PHASE,
        stage: "end",
        procedure: path,
        type,
        userId,
        role,
        duration,
        status: "error",
        error: {
          code: result.error.code,
          message: result.error.message,
          ...(causeInfo ? { cause: causeInfo } : {}),
        },
      });
    }

    return result;
  },
);

// Best-effort target from common id keys; productId precedes groupId
// (product is the attached/detached entity). No-op for queries and auth.*.
// No before/after diff — outcome is success|fail with error reason only.
const TARGET_ID_KEYS = [
  "sectionId",
  "reportId",
  "periodId",
  "projectId",
  "leadId",
  "id",
  "userId",
  "productId",
  "groupId",
] as const;

const MAX_AUDIT_REASON_LENGTH = 500;

function truncateReason(reason: string, max = MAX_AUDIT_REASON_LENGTH): string {
  if (reason.length <= max) return reason;
  return reason.slice(0, max).trimEnd();
}

async function readOptionalRawInput(
  getRawInput: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await getRawInput();
  } catch {
    return undefined;
  }
}

function extractAuditTarget(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const targetKey = TARGET_ID_KEYS.find(
    (key) => typeof record[key] === "string",
  );
  return targetKey ? (record[targetKey] as string) : undefined;
}

const mutationAuditMiddleware = t.middleware(
  async ({ ctx, next, path, type, getRawInput }) => {
    if (type !== "mutation") return next();
    if (path.startsWith("auth.")) return next();

    const start = performance.now();
    const result = await next();
    const duration = Math.round(performance.now() - start);

    // getRawInput() can throw on already-consumed bodies; skip target
    // extraction rather than crash the audit emit.
    const target = extractAuditTarget(await readOptionalRawInput(getRawInput));

    const action = {
      userId: ctx.session?.userId ?? "anonymous",
      role: ctx.session?.role ?? null,
      ip: ctx.ip,
      procedure: path,
      target,
      status: result.ok ? "success" : "fail",
      duration,
      ...(result.ok ? {} : { reason: result.error.message }),
    } as const;

    ctx.auditLogger.mutation(action);

    if (ctx.prisma?.userActionLog) {
      try {
        await ctx.prisma.userActionLog.create({
          data: {
            userId: action.userId,
            role: action.role,
            procedure: path,
            targetId: target,
            status: action.status,
            reason: result.ok ? null : truncateReason(result.error.message),
            ip: ctx.ip,
            correlationId: ctx.correlationId ?? "no-context",
            durationMs: duration,
          },
        });
      } catch (error) {
        ctx.logger.warn("user action log persist failed", {
          phase: "audit.persist",
          procedure: path,
          status: action.status,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: typeof error, message: String(error) },
        });
      }
    }

    return result;
  },
);

export const publicProcedure = t.procedure
  .use(metricsMiddleware)
  .use(loggingMiddleware);

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return next({ ctx: { session: ctx.session } });
});

// PDF sessions: hard-coded read-only allowlist + reportId match so a
// cookie for report X cannot read report Y. New print paths must be added
// here. No-op for non-PDF sessions.
const PDF_EXPORT_ALLOWED_PATHS: ReadonlySet<string> = new Set([
  "weeklyReport.get",
  "archive.detail",
]);

const pdfExportGuard = t.middleware(
  async ({ ctx, path, next, getRawInput }) => {
    if (!ctx.isPdfExport) {
      return next();
    }

    if (!PDF_EXPORT_ALLOWED_PATHS.has(path)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Procedure ${path} not permitted for PDF-export session`,
      });
    }

    // Cross-check the input reportId against the JWT claim. A PDF cookie
    // bound to report X must not be reusable to read report Y.
    const raw = await readOptionalRawInput(getRawInput);
    const inputReportId =
      raw && typeof raw === "object" && "reportId" in raw
        ? (raw as { reportId?: unknown }).reportId
        : undefined;

    if (
      typeof inputReportId !== "string" ||
      inputReportId !== ctx.pdfReportId
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "PDF-export session reportId does not match procedure input",
      });
    }

    return next();
  },
);

// Canonical chain from t.procedure (not publicProcedure) so public-only
// middleware cannot leak in. Order is security-load-bearing: metrics →
// logging → auth → pdfExportGuard → mutationAudit.
function buildProtectedProcedure(authMiddleware: typeof isAuthed) {
  return t.procedure
    .use(metricsMiddleware)
    .use(loggingMiddleware)
    .use(authMiddleware)
    .use(pdfExportGuard)
    .use(mutationAuditMiddleware);
}

export const protectedProcedure = buildProtectedProcedure(isAuthed);

// Local wrapper around assertRole so deny can emit role-denied via ctx
// auditLogger/ip — every consumer inherits the audit signal automatically.
function buildRoleMiddleware(allowed: Role | Role[]) {
  return t.middleware<{ session: UserSession }>(async ({ ctx, next }) => {
    try {
      const session = assertRole(ctx.session, allowed);
      return await next({ ctx: { session } });
    } catch (error) {
      if (error instanceof TRPCError && error.code === "FORBIDDEN") {
        // Even when role/userId are missing, emit so the audit trail captures
        // the attempt rather than swallowing it.
        ctx.auditLogger.roleDenied({
          userId: ctx.session?.userId ?? "anonymous",
          role: ctx.session?.role ?? null,
          attemptedRole: allowed,
          ip: ctx.ip,
        });
      }
      throw error;
    }
  });
}

// headProcedure allows head+admin; adminProcedure is admin-only (heads
// have a dashboard, not /admin/*). Admin still passes head procedures.
const headRoleMiddleware = buildRoleMiddleware(["head", "admin"]);
const adminRoleMiddleware = buildRoleMiddleware("admin");
const leadRoleMiddleware = buildRoleMiddleware("lead");
const viewerRoleMiddleware = buildRoleMiddleware("viewer");
// Service-layer gate for multi-role reads (archive.*, weeklyReport.get).
const anyRoleMiddleware = buildRoleMiddleware([
  "lead",
  "head",
  "admin",
  "viewer",
]);
// Leadership-audience procedure. Used by
// `telemetry.summary` and any other product-KPI surface that the head,
// admin, and viewer share but lead must NOT see (a lead is the data
// subject of these KPIs, not a consumer of them). This is distinct from
// `anyRoleProcedure` because lead is excluded.
const leadershipRoleMiddleware = buildRoleMiddleware([
  "head",
  "admin",
  "viewer",
]);

export const headProcedure = buildProtectedProcedure(headRoleMiddleware);
export const leadProcedure = buildProtectedProcedure(leadRoleMiddleware);
export const viewerProcedure = buildProtectedProcedure(viewerRoleMiddleware);
export const anyRoleProcedure = buildProtectedProcedure(anyRoleMiddleware);
// Admin-only gate. /admin/* tRPC endpoints attach this; head
// users get FORBIDDEN. Use headProcedure for endpoints that should be
// reachable by both head and admin (dashboards, weekly reports, review).
export const adminProcedure = buildProtectedProcedure(adminRoleMiddleware);
// Leadership procedure — head + admin + viewer.
// Lead is excluded by design (lead is the data subject of product KPIs).
export const leadershipProcedure = buildProtectedProcedure(
  leadershipRoleMiddleware,
);

export const router = t.router;
