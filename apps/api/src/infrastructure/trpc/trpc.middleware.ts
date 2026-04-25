import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

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

const isHead = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  if (ctx.session.role !== 'head') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Head role required' });
  }

  return next({ ctx: { session: ctx.session } });
});

export const headProcedure = t.procedure.use(loggingMiddleware).use(isHead);

export const router = t.router;
export const mergeRouters = t.mergeRouters;
