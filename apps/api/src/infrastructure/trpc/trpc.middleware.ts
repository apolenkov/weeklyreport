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
export const loggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();
  const userId = ctx.session?.userId ?? null;

  ctx.logger.info('trpc request start', {
    phase: 'trpc.request',
    stage: 'start',
    procedure: path,
    type,
    userId,
  });

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
  } else {
    ctx.logger.error('trpc request end', {
      phase: 'trpc.request',
      stage: 'end',
      procedure: path,
      type,
      userId,
      duration,
      status: 'error',
      error: { code: result.error.code, message: result.error.message },
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

export const protectedProcedure = t.procedure.use(loggingMiddleware).use(isAuthed);

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
          role: ctx.session?.role ?? 'unknown',
          attemptedRole: allowed,
          ip: ctx.ip,
        });
      }
      throw err;
    }
  });
}

const headRoleMiddleware = buildRoleMiddleware('head');
const leadRoleMiddleware = buildRoleMiddleware('lead');
const viewerRoleMiddleware = buildRoleMiddleware('viewer');
// AUTH-04 (Phase 28-01): a "any authenticated role" procedure for read paths
// where the service layer is the actual gate (Prisma `where` filtered by
// session.role). Necessary for archive.* and weeklyReport.get because heads,
// leads, admins, and viewers all read the same surface but with different
// row visibility. Service-level unit tests verify the role-aware filter.
const anyRoleMiddleware = buildRoleMiddleware(['lead', 'head', 'admin', 'viewer']);

export const headProcedure = t.procedure.use(loggingMiddleware).use(headRoleMiddleware);
export const leadProcedure = t.procedure.use(loggingMiddleware).use(leadRoleMiddleware);
export const viewerProcedure = t.procedure.use(loggingMiddleware).use(viewerRoleMiddleware);
export const anyRoleProcedure = t.procedure.use(loggingMiddleware).use(anyRoleMiddleware);
export const adminProcedure = headProcedure;

export const router = t.router;
export const mergeRouters = t.mergeRouters;
