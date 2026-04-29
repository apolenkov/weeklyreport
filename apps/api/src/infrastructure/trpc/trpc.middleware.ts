import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

import { requireRole } from '@customreport/shared/trpc';

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

// AUTH-03 (Phase 27): role-bound procedures derived from the shared
// requireRole factory. The factory lives in @customreport/shared/trpc and is
// parameterised over the api's local `t` instance, so the middleware closes
// over the api's TrpcContext type while the contract stays in the shared
// package. adminProcedure === headProcedure for v6.0 per D-AUTH-03 — admin
// is a reserved alias until SAML attribute mapping (Phase 29 / AUTH-02)
// distinguishes it. Existing callers of headProcedure see no breaking diff.
const headRole = requireRole(t, 'head');
const leadRole = requireRole(t, 'lead');
const viewerRole = requireRole(t, 'viewer');
// AUTH-04 (Phase 28-01): a "any authenticated role" procedure for read paths
// where the service layer is the actual gate (Prisma `where` filtered by
// session.role). Necessary for archive.* and weeklyReport.get because heads,
// leads, admins, and viewers all read the same surface but with different
// row visibility. Service-level unit tests verify the role-aware filter.
const anyRole = requireRole(t, ['lead', 'head', 'admin', 'viewer']);

export const headProcedure = t.procedure.use(loggingMiddleware).use(headRole.middleware);
export const leadProcedure = t.procedure.use(loggingMiddleware).use(leadRole.middleware);
export const viewerProcedure = t.procedure.use(loggingMiddleware).use(viewerRole.middleware);
export const anyRoleProcedure = t.procedure.use(loggingMiddleware).use(anyRole.middleware);
export const adminProcedure = headProcedure;

export const router = t.router;
export const mergeRouters = t.mergeRouters;
