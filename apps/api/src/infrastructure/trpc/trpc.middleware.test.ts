import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';

import {
  router,
  publicProcedure,
  protectedProcedure,
  headProcedure,
} from './trpc.middleware.js';

// ---------------------------------------------------------------------------
// Test router
// ---------------------------------------------------------------------------

const testRouter = router({
  publicRoute: publicProcedure.query(() => 'public-ok'),
  protectedRoute: protectedProcedure.query(() => 'auth-ok'),
  headRoute: headProcedure.query(() => 'head-ok'),
});

// ---------------------------------------------------------------------------
// Caller contexts
// ---------------------------------------------------------------------------

const nullCaller = testRouter.createCaller({ session: null });

const leadCaller = testRouter.createCaller({
  session: {
    userId: 'u1',
    email: 'lead@test.com',
    name: 'Lead User',
    role: 'lead' as const,
    activeReportId: 'r1',
    activeReportSectionId: 's1',
  },
});

const headCaller = testRouter.createCaller({
  session: {
    userId: 'u2',
    email: 'head@test.com',
    name: 'Head User',
    role: 'head' as const,
    activeReportId: 'r1',
    activeReportSectionId: null,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tRPC auth middleware', () => {
  it('publicProcedure allows null session', async () => {
    const result = await nullCaller.publicRoute();
    expect(result).toBe('public-ok');
  });

  it('protectedProcedure rejects null session with UNAUTHORIZED', async () => {
    await expect(nullCaller.protectedRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('protectedProcedure allows lead session', async () => {
    const result = await leadCaller.protectedRoute();
    expect(result).toBe('auth-ok');
  });

  it('headProcedure rejects lead session with FORBIDDEN', async () => {
    await expect(leadCaller.headRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('headProcedure allows head session', async () => {
    const result = await headCaller.headRoute();
    expect(result).toBe('head-ok');
  });

  it('headProcedure rejects null session with UNAUTHORIZED', async () => {
    await expect(nullCaller.headRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('thrown errors are TRPCError instances', async () => {
    try {
      await nullCaller.protectedRoute();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
    }
  });
});
