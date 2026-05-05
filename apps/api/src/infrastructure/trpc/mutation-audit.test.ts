import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { router, protectedProcedure, leadProcedure } from './trpc.middleware.js';
import { createNullLogger } from '../../lib/logger.js';
import type { AuditLogger } from '../../lib/audit-logger.js';

/**
 * 36-02 mutation-audit middleware tests.
 *
 * Asserts the middleware:
 *   - emits exactly one `mutation` event per authenticated mutation
 *   - skips queries
 *   - skips auth.* and ai.* (covered elsewhere / privacy)
 *   - emits status=fail with reason on TRPCError
 *   - extracts `target` from common input id keys
 */

function makeAuditSpy(): {
  audit: AuditLogger;
  mutation: ReturnType<typeof vi.fn>;
} {
  const mutation = vi.fn();
  const audit: AuditLogger = {
    loginSuccess: vi.fn(),
    loginFail: vi.fn(),
    logout: vi.fn(),
    roleDenied: vi.fn(),
    mutation,
  };
  return { audit, mutation };
}

const nullLogger = createNullLogger();
const TEST_IP = 'test-ip';

const leadSession = {
  userId: 'u1',
  email: 'lead@test.com',
  name: 'Lead User',
  role: 'lead' as const,
  activeReportId: 'r1',
  activeReportSectionId: 's1',
};

const auditTestRouter = router({
  // Mutation with sectionId in input — target should be extracted.
  saveDraft: leadProcedure
    .input(z.object({ sectionId: z.string(), text: z.string() }))
    .mutation(({ input }) => ({ id: input.sectionId, ok: true })),

  // Mutation that throws — status should be fail with reason.
  failingMutation: leadProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'boom' });
    }),

  // Query — should NOT trigger mutation event.
  queryRoute: protectedProcedure.query(() => 'q-ok'),

  // ai.* mutation — should be skipped (privacy).
  ai: router({
    fakeMutation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(() => 'ai-ok'),
  }),

  // auth.* mutation — should be skipped (covered by login events).
  auth: router({
    fakeMutation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(() => 'auth-ok'),
  }),
});

describe('36-02 mutation-audit middleware', () => {
  it('emits exactly one mutation event on a successful authenticated mutation', async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger: nullLogger,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.saveDraft({ sectionId: 'sec-42', text: 'hi' });

    expect(mutation).toHaveBeenCalledTimes(1);
    const call = mutation.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      userId: 'u1',
      role: 'lead',
      ip: TEST_IP,
      procedure: 'saveDraft',
      target: 'sec-42',
      status: 'success',
    });
    expect(typeof call?.duration).toBe('number');
  });

  it('emits status=fail with reason when the mutation throws', async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger: nullLogger,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.failingMutation({ id: 'thing-1' })).rejects.toThrow();

    expect(mutation).toHaveBeenCalledTimes(1);
    const call = mutation.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      procedure: 'failingMutation',
      target: 'thing-1',
      status: 'fail',
      reason: 'boom',
    });
  });

  it('does NOT emit a mutation event for a query', async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger: nullLogger,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.queryRoute();

    expect(mutation).not.toHaveBeenCalled();
  });

  it('skips ai.* and auth.* mutations', async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger: nullLogger,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.ai.fakeMutation({ id: 'a' });
    await caller.auth.fakeMutation({ id: 'b' });

    expect(mutation).not.toHaveBeenCalled();
  });
});
