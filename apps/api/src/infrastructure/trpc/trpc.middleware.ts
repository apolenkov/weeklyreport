import { type Role, type UserSession } from "@customreport/shared";
import { assertRole } from "@customreport/shared/trpc";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import {
  ANONYMOUS_USER_ID,
  NO_CORRELATION_ID,
} from "../../lib/actor-sentinels.js";
import { trpcMetricsMiddleware as recordTrpcMetrics } from "../metrics/trpc-metrics.middleware.js";
import { recordMutationAudit } from "./trpc.audit.js";
import type { TrpcContext } from "./trpc.context.js";
import {
  logInputBreadcrumb,
  logRequestStart,
  recordTrpcFailure,
  recordTrpcSuccess,
  type TrpcCallIdentity,
} from "./trpc.logging.js";

export { deriveCauseInfo } from "./trpc.logging.js";

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
        requestId: ctx?.correlationId ?? NO_CORRELATION_ID,
      },
    };
  },
});

// getRawInput() can throw on malformed or already-consumed bodies; callers that
// only need a best-effort peek at the input skip it rather than crash.
async function readOptionalRawInput(
  getRawInput: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await getRawInput();
  } catch {
    return undefined;
  }
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
    const identity: TrpcCallIdentity = {
      procedure: path,
      type,
      userId: ctx.session?.userId ?? null,
      role: ctx.session?.role ?? null,
    };

    logRequestStart(ctx.logger, identity);
    await logInputBreadcrumb(ctx.logger, path, type, getRawInput);

    const result = await next();
    const duration = Math.round(performance.now() - start);

    if (result.ok) {
      recordTrpcSuccess(ctx.logger, identity, duration, result.data);
    } else {
      recordTrpcFailure(ctx.logger, identity, duration, result.error);
    }

    return result;
  },
);

interface MutationAuditInputState {
  captured: boolean;
  decodedInput: unknown;
}

const MUTATION_AUDIT_INPUT_STATE = Symbol("mutationAuditInputState");

type MutationAuditContext = TrpcContext & {
  readonly [MUTATION_AUDIT_INPUT_STATE]?: MutationAuditInputState;
};

const mutationAuditMiddleware = t.middleware(
  async ({ ctx, next, path, type }) => {
    if (type !== "mutation") return next();
    if (path.startsWith("auth.")) return next();
    if (path.startsWith("ai.")) return next();

    const start = performance.now();
    const inputState: MutationAuditInputState = {
      captured: false,
      decodedInput: undefined,
    };
    const result = await next({
      ctx: { [MUTATION_AUDIT_INPUT_STATE]: inputState },
    });
    const duration = Math.round(performance.now() - start);

    await recordMutationAudit(ctx, {
      procedure: path,
      decodedInput: inputState.captured ? inputState.decodedInput : undefined,
      status: result.ok ? "success" : "fail",
      failureCode: result.ok ? null : result.error.code,
      durationMs: duration,
    });

    return result;
  },
);

// Attach immediately after a mutation's final `.input(...)`. At that point
// tRPC has completed validation and unknown-key stripping, so the outer audit
// middleware can extract identifiers without inspecting transport input.
export const captureMutationAuditInputMiddleware = t.middleware(
  ({ ctx, input, next, type }) => {
    if (type === "mutation") {
      const inputState = (ctx as MutationAuditContext)[
        MUTATION_AUDIT_INPUT_STATE
      ];
      if (!inputState) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Mutation audit input capture is outside the canonical chain",
        });
      }
      inputState.captured = true;
      inputState.decodedInput = input;
    }
    return next();
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
  "pdfExport.render",
]);

function assertPdfExportRenderInput(
  raw: unknown,
  ctx: {
    readonly pdfJobId: string | null | undefined;
    readonly pdfReportId: string | null;
  },
): void {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (input.jobId !== ctx.pdfJobId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PDF-export session jobId does not match procedure input",
    });
  }
  if (input.reportId !== ctx.pdfReportId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PDF-export session reportId does not match procedure input",
    });
  }
}

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

    if (path === "pdfExport.render") {
      assertPdfExportRenderInput(raw, ctx);
      return next();
    }

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
          userId: ctx.session?.userId ?? ANONYMOUS_USER_ID,
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
// Service-layer gate for multi-role weekly-report reads.
const anyRoleMiddleware = buildRoleMiddleware([
  "lead",
  "head",
  "admin",
  "viewer",
]);
// Leadership audience: head, admin and viewer share these product-KPI surfaces
// (telemetry.summary, pdfExport.*) but lead must NOT see them — a lead is the
// data subject of these KPIs, not a consumer of them.
const leadershipRoleMiddleware = buildRoleMiddleware([
  "head",
  "admin",
  "viewer",
]);

export const headProcedure = buildProtectedProcedure(headRoleMiddleware);
export const leadProcedure = buildProtectedProcedure(leadRoleMiddleware);
export const anyRoleProcedure = buildProtectedProcedure(anyRoleMiddleware);
// Admin-only gate. /admin/* tRPC endpoints attach this; head users get
// FORBIDDEN. Use headProcedure for endpoints reachable by both head and admin
// (dashboards, weekly reports, review).
export const adminProcedure = buildProtectedProcedure(adminRoleMiddleware);
export const leadershipProcedure = buildProtectedProcedure(
  leadershipRoleMiddleware,
);

export const router = t.router;
