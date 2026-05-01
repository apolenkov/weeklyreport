import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

import { assertRole } from '@customreport/shared/trpc';
import type { Role, UserSession } from '@customreport/shared';

import type { TrpcContext } from './trpc.context.js';

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

/**
 * Logging middleware — emits one entry log on procedure start and one exit log
 * on completion (success or error). Both lines carry the same correlationId via
 * the CLS store wired by Phase 25 / Plan 01 / Task 1, because the underlying
 * AppLogger reads correlationId from CLS at emit time.
 *
 * Applied BEFORE auth middleware on every procedure helper so that failed-auth
 * attempts are still recorded (security forensics > anonymous-noise risk).
 */
export const loggingMiddleware = t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
  // Phase 31 (AI-SPEC §5.3 / PITFALLS C-3): AI prompts and responses must
  // never reach the structured log stream. Token usage and timing are
  // recorded in AiInsight rows instead.
  if (path.startsWith('ai.')) {
    return next();
  }

  const start = performance.now();
  const userId = ctx.session?.userId ?? null;

  ctx.logger.info('trpc request start', {
    phase: 'trpc.request',
    stage: 'start',
    procedure: path,
    type,
    userId,
  });

  // Debug-level dump of the raw input. Gated behind LOG_LEVEL=debug so the
  // hot path stays cheap in info-level prod logs. Avoid logging when the
  // input contains sensitive auth payloads (none today, but keep the
  // breadcrumb here in case auth.* gains an input in future).
  if (path !== 'auth.login' && path !== 'auth.refresh') {
    try {
      const rawInput = await getRawInput();
      if (rawInput !== undefined) {
        ctx.logger.debug('trpc request input', {
          phase: 'trpc.request',
          stage: 'input',
          procedure: path,
          type,
          input: rawInput,
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
    ctx.logger.info('trpc request end', {
      phase: 'trpc.request',
      stage: 'end',
      procedure: path,
      type,
      userId,
      duration,
      status: 'success',
    });
    // Debug-level snapshot of the response payload. Truncated to avoid
    // bloating logs when a procedure returns large arrays (e.g.
    // archive.list, analytics.weekly). 4 KB is enough to see shape +
    // first-page contents; tail callers can paginate to see more.
    try {
      const serialised = JSON.stringify(result.data);
      const preview = serialised && serialised.length > 4096
        ? `${serialised.slice(0, 4096)}…<truncated ${serialised.length - 4096}b>`
        : serialised;
      ctx.logger.debug('trpc request output', {
        phase: 'trpc.request',
        stage: 'output',
        procedure: path,
        type,
        outputPreview: preview,
      });
    } catch {
      // Non-serialisable result — skip the breadcrumb rather than throw.
    }
  } else {
    // Drill into TRPCError.cause so the log stream surfaces the real failure
    // (Prisma error, ZodError, raw Error, etc.) instead of just the generic
    // 'Unexpected error' wrapper from trpc.error-mapper.ts. This is the
    // single biggest payoff for backend debuggability — a TRPCError with
    // code=INTERNAL_SERVER_ERROR is otherwise opaque.
    const cause = result.error.cause;
    const causeInfo =
      cause instanceof Error
        ? {
            name: cause.constructor.name,
            message: cause.message,
            stack: cause.stack,
            // Prisma errors: surface code + meta so query failures are
            // identifiable without re-running with debug enabled.
            ...('code' in cause ? { causeCode: (cause as { code?: unknown }).code } : {}),
            ...('meta' in cause ? { causeMeta: (cause as { meta?: unknown }).meta } : {}),
          }
        : cause !== undefined
          ? { rawCause: String(cause) }
          : undefined;

    ctx.logger.error('trpc request end', {
      phase: 'trpc.request',
      stage: 'end',
      procedure: path,
      type,
      userId,
      duration,
      status: 'error',
      error: {
        code: result.error.code,
        message: result.error.message,
        stack: result.error.stack,
        ...(causeInfo ? { cause: causeInfo } : {}),
      },
    });
  }

  return result;
});

export const publicProcedure = t.procedure.use(loggingMiddleware);

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  return next({ ctx: { session: ctx.session } });
});

/**
 * Phase 32-B1 (H-04): PDF-export-scoped session guard.
 *
 * When the inbound cookie verified as a PDF-export JWT (ctx.isPdfExport),
 * the synthetic viewer session must be restricted to a tiny read-only
 * allowlist scoped to the JWT's `reportId` claim. Any other procedure
 * throws FORBIDDEN. The allowlisted procedure must also reference
 * `ctx.pdfReportId` in its input — otherwise a leaked PDF cookie for
 * report X could be used to read report Y.
 *
 * The allowlist intentionally hard-codes paths instead of a per-procedure
 * opt-in: the v6.0 print page calls only `weeklyReport.get` and
 * `archive.detail`. New PDF-print pages must add their procedure here.
 *
 * Applied via `protectedProcedure` so every authenticated path inherits
 * the check; the middleware is a no-op for non-PDF sessions.
 */
const PDF_EXPORT_ALLOWED_PATHS: ReadonlySet<string> = new Set([
  'weeklyReport.get',
  'archive.detail',
]);

const pdfExportGuard = t.middleware(async ({ ctx, path, next, getRawInput }) => {
  if (!ctx.isPdfExport) {
    return next();
  }

  if (!PDF_EXPORT_ALLOWED_PATHS.has(path)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Procedure ${path} not permitted for PDF-export session`,
    });
  }

  // Cross-check the input reportId against the JWT claim. A PDF cookie
  // bound to report X must not be reusable to read report Y.
  let raw: unknown;
  try {
    raw = await getRawInput();
  } catch {
    raw = undefined;
  }
  const inputReportId =
    raw && typeof raw === 'object' && 'reportId' in raw
      ? (raw as { reportId?: unknown }).reportId
      : undefined;

  if (typeof inputReportId !== 'string' || inputReportId !== ctx.pdfReportId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'PDF-export session reportId does not match procedure input',
    });
  }

  return next();
});

export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(isAuthed)
  .use(pdfExportGuard);

// AUTH-03 (Phase 27) + AUTH-08 (Phase 29-01): role-bound procedures whose
// deny branch emits a structured `role-denied` audit event before throwing
// FORBIDDEN. The role check itself is delegated to the pure `assertRole`
// helper from @customreport/shared/trpc — the contract is identical, but
// the middleware lives locally so it can read `ctx.auditLogger` / `ctx.ip`
// from the api's TrpcContext. Per A-1 (defense-in-depth): the emit lives
// inside the factory so every consumer site inherits the audit signal
// automatically, including future SAML-driven deny conditions in Phase
// 29-04.
//
// adminProcedure === headProcedure for v6.0 per D-AUTH-03 — admin is a
// reserved alias until SAML attribute mapping (Phase 29 / AUTH-02)
// distinguishes it. Existing callers of headProcedure see no breaking diff.
function buildRoleMiddleware(allowed: Role | Role[]) {
  return t.middleware<{ session: UserSession }>(async ({ ctx, next }) => {
    try {
      const session = assertRole(ctx.session, allowed);
      return next({ ctx: { session } });
    } catch (err) {
      if (err instanceof TRPCError && err.code === 'FORBIDDEN') {
        // T2 mitigation: even when role/userId are missing, emit so the
        // audit trail captures the attempt rather than swallowing it.
        ctx.auditLogger.roleDenied({
          userId: ctx.session?.userId ?? 'anonymous',
          role: ctx.session?.role ?? null,
          attemptedRole: allowed,
          ip: ctx.ip,
        });
      }
      throw err;
    }
  });
}

// admin is a superset of head: per D-AUTH-03 (Phase 27 CONTEXT) "adminProcedure
// === headProcedure for v6.0" — admin must pass the head gate. After H-01
// (Phase 32-c1) widened the Role enum to include 'admin' as a real value,
// the middleware needs the same widening so admin SAML logins can hit
// admin.* / head.* procedures. Discovered in live test (admin user got 403
// on admin.dlqCount, admin.snapshot, admin.getSettings).
const headRoleMiddleware = buildRoleMiddleware(['head', 'admin']);
const leadRoleMiddleware = buildRoleMiddleware('lead');
const viewerRoleMiddleware = buildRoleMiddleware('viewer');
// AUTH-04 (Phase 28-01): a "any authenticated role" procedure for read paths
// where the service layer is the actual gate (Prisma `where` filtered by
// session.role). Necessary for archive.* and weeklyReport.get because heads,
// leads, admins, and viewers all read the same surface but with different
// row visibility. Service-level unit tests verify the role-aware filter.
const anyRoleMiddleware = buildRoleMiddleware(['lead', 'head', 'admin', 'viewer']);

export const headProcedure = t.procedure
  .use(loggingMiddleware)
  .use(headRoleMiddleware)
  .use(pdfExportGuard);
export const leadProcedure = t.procedure
  .use(loggingMiddleware)
  .use(leadRoleMiddleware)
  .use(pdfExportGuard);
export const viewerProcedure = t.procedure
  .use(loggingMiddleware)
  .use(viewerRoleMiddleware)
  .use(pdfExportGuard);
export const anyRoleProcedure = t.procedure
  .use(loggingMiddleware)
  .use(anyRoleMiddleware)
  .use(pdfExportGuard);
export const adminProcedure = headProcedure;

export const router = t.router;
export const mergeRouters = t.mergeRouters;
