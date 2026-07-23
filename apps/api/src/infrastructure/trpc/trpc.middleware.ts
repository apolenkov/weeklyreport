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

/**
 * Describe a tRPC response shape for debug logs without exposing values.
 * Returns a compact descriptor (top-level keys for objects, length+inner
 * keys for arrays, primitive type otherwise). Earlier `outputPreview`
 * dumped the full JSON — that leaked email/role/userId on every auth.me /
 * admin.* call.
 */
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

/**
 * Normalize a `TRPCError.cause` into a log-safe descriptor. Drilling into the
 * cause is what surfaces the real failure (Prisma error, ZodError, raw Error)
 * instead of the generic 'Unexpected error' wrapper from trpc.error-mapper.ts —
 * a TRPCError with code=INTERNAL_SERVER_ERROR is otherwise opaque. tRPC
 * normalizes thrown values via getCauseFromUnknown, so the meaningful detail is
 * always an Error; a non-Error/undefined cause carries nothing to log.
 *
 * Stack frames leak file paths + library internals to the log aggregator, so
 * only `code`/`meta` are surfaced — Prisma's pair already identifies the failed
 * query.
 */
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

/**
 * Prometheus middleware — records per-procedure latency
 * (`trpc_request_duration_seconds`) and request volume
 * (`trpc_request_total`) with labels `procedure`/`type`/`status`. Wired
 * BEFORE `loggingMiddleware` on every procedure helper so timings
 * exclude logger / audit / Prisma-userActionLog overhead. The actual
 * histogram emit lives in `infrastructure/metrics/trpc-metrics.middleware.ts`
 * — this thin t.middleware wrapper just delegates to it so the metrics
 * code stays framework-agnostic and unit-testable without `initTRPC`.
 */
export const metricsMiddleware = t.middleware(({ path, type, next }) =>
  recordTrpcMetrics({ path, type, next }),
);

/**
 * Logging middleware — emits one entry log on procedure start and one exit log
 * on completion (success or error). Both lines carry the same correlationId via
 * the CLS store, because the underlying
 * AppLogger reads correlationId from CLS at emit time.
 *
 * Applied BEFORE auth middleware on every procedure helper so that failed-auth
 * attempts are still recorded (security forensics > anonymous-noise risk).
 */
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
      // Debug-level shape breadcrumb. Logs only the response *shape* (top-level
      // keys + array length), never values — earlier `outputPreview` dumped the
      // full serialised response which leaked email/role/userId into the log
      // stream on every auth.me / admin.* / weeklyReport.get call.
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

/**
 * Mutation-audit middleware.
 *
 * Captures every authenticated tRPC mutation through the existing
 * AuditLogger (so audit signal flows through the same AppLogger envelope as
 * login-success / login-fail / role-denied). The middleware is a no-op for
 * queries and for `auth.*` (covered by login events).
 *
 * `target` extraction is best-effort: we read whichever common id key is
 * present in the input (sectionId / reportId / periodId / projectId /
 * leadId / id / userId / productId / groupId), without inspecting deeper
 * structures. Established keys retain precedence; productId precedes groupId
 * because the product is the entity being attached or detached. Mutations
 * like `period.publish` that take no id leave `target` undefined.
 *
 * Outcome is success | fail; on failure, `reason` carries the error
 * message. No before/after diff is captured — Prisma-side introspection is
 * deferred to a future phase if SIEM/forensics needs it.
 */
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

/**
 * PDF-export-scoped session guard.
 *
 * When the inbound cookie verified as a PDF-export JWT (ctx.isPdfExport),
 * the synthetic viewer session must be restricted to a tiny read-only
 * allowlist scoped to the JWT's `reportId` claim. Any other procedure
 * throws FORBIDDEN. The allowlisted procedure must also reference
 * `ctx.pdfReportId` in its input — otherwise a leaked PDF cookie for
 * report X could be used to read report Y.
 *
 * The allowlist intentionally hard-codes paths instead of a per-procedure
 * opt-in: the print page calls only `weeklyReport.get` and
 * `archive.detail`. New PDF-print pages must add their procedure here.
 *
 * Applied via `protectedProcedure` so every authenticated path inherits
 * the check; the middleware is a no-op for non-PDF sessions.
 */
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

/**
 * Factory that defines the canonical 5-middleware chain once:
 * metrics → logging → authMiddleware → pdfExportGuard → mutationAudit.
 *
 * Built from `t.procedure` directly (NOT derived from publicProcedure) so
 * any future public-only middleware does not silently propagate into every
 * protected chain. Security-ordering contract: logging runs BEFORE auth
 * (failed-auth forensics) and metrics before logging (timing excludes logger
 * overhead). Any reordering is a behavior change, not a cleanup.
 */
function buildProtectedProcedure(authMiddleware: typeof isAuthed) {
  return t.procedure
    .use(metricsMiddleware)
    .use(loggingMiddleware)
    .use(authMiddleware)
    .use(pdfExportGuard)
    .use(mutationAuditMiddleware);
}

export const protectedProcedure = buildProtectedProcedure(isAuthed);

// Role-bound procedures whose
// deny branch emits a structured `role-denied` audit event before throwing
// FORBIDDEN. The role check itself is delegated to the pure `assertRole`
// helper from @customreport/shared/trpc — the contract is identical, but
// the middleware lives locally so it can read `ctx.auditLogger` / `ctx.ip`
// from the api's TrpcContext. Per defense-in-depth: the emit lives
// inside the factory so every consumer site inherits the audit signal
// automatically, including future SAML-driven deny conditions.
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

// headProcedure still allows
// head + admin (admin is god-mode that inherits head capabilities), but
// adminProcedure is now its own gate that ONLY admins pass. Heads can no
// longer access /admin/* tRPC endpoints — they have a dashboard, not an
// admin panel. Admin still passes head procedures (admin SAML user gets
// through head procedures) because admin stays in the head allowlist.
const headRoleMiddleware = buildRoleMiddleware(["head", "admin"]);
const adminRoleMiddleware = buildRoleMiddleware("admin");
const leadRoleMiddleware = buildRoleMiddleware("lead");
const viewerRoleMiddleware = buildRoleMiddleware("viewer");
// A "any authenticated role" procedure for read paths
// where the service layer is the actual gate (Prisma `where` filtered by
// session.role). Necessary for archive.* and weeklyReport.get because heads,
// leads, admins, and viewers all read the same surface but with different
// row visibility. Service-level unit tests verify the role-aware filter.
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
