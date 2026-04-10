import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';

import type { TrpcContext } from './trpc.context.js';

const t = initTRPC.context<TrpcContext>().create();

export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  return next({ ctx: { session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

const isHead = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  if (ctx.session.role !== 'head') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Head role required' });
  }

  return next({ ctx: { session: ctx.session } });
});

export const headProcedure = t.procedure.use(isHead);

export const router = t.router;
export const mergeRouters = t.mergeRouters;
