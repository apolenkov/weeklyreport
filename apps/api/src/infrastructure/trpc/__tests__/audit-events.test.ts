import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';

import {
  router,
  publicProcedure,
  headProcedure,
} from '../trpc.middleware.js';
import type { AppLogger } from '../../../lib/logger.js';
import {
  createAuditLogger,
  type AuditLogger,
} from '../../../lib/audit-logger.js';

// ---------------------------------------------------------------------------
// AUTH-08 audit-events end-to-end signal test (Phase 29-01).
//
// Boots a viewer session against a head-only procedure, captures every
// AppLogger emit, and asserts EXACTLY ONE role-denied envelope appears.
// This locks the A-1 invariant: defense-in-depth means the audit signal
// fires from inside the role-middleware factory, NOT only at controller
// seams — so any future deny path (Phase 29-04 SAML cut-over, Phase 28-01
// viewer-only filters) inherits the audit emit automatically.
// ---------------------------------------------------------------------------

type Captured = {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, unknown>;
};

function makeCapturingLogger(): { logger: AppLogger; entries: Captured[] } {
  const entries: Captured[] = [];
  const push = (level: Captured['level']) =>
    (message: string, context?: Record<string, unknown>) => {
      entries.push({ level, message, context });
    };
  const logger: AppLogger = {
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    child() {
      return logger;
    },
  };
  return { logger, entries };
}

const testRouter = router({
  publicRoute: publicProcedure.query(() => 'public-ok'),
  headRoute: headProcedure.query(() => 'head-ok'),
});

describe('AUTH-08 role-denied integration signal', () => {
  it('a viewer call to a head-only procedure produces exactly one role-denied envelope', async () => {
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: {
        userId: 'viewer-1',
        email: 'viewer@test.com',
        name: 'Viewer User',
        role: 'viewer',
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger,
      auditLogger,
      ip: '10.0.0.42',
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.headRoute()).rejects.toBeInstanceOf(TRPCError);

    const auditEntries = entries.filter((e) => e.message === 'audit');
    expect(auditEntries).toHaveLength(1);

    const audit = auditEntries[0]!;
    expect(audit.level).toBe('warn');
    expect(audit.context).toMatchObject({
      event: 'role-denied',
      userId: 'viewer-1',
      role: 'viewer',
      ip: '10.0.0.42',
    });

    // attemptedRole carries the allowed Role | Role[] verbatim — headProcedure
    // accepts ['head', 'admin'] per D-AUTH-03 alias semantics (commit 413ef34
    // after live-test discovered admin role got 403 on admin.* procedures).
    expect(audit.context?.['attemptedRole']).toEqual(['head', 'admin']);

    // Negative — no spurious login-success was emitted by the role-deny path.
    const loginSuccesses = entries.filter(
      (e) => e.context?.['event'] === 'login-success',
    );
    expect(loginSuccesses).toHaveLength(0);
  });

  it('an authenticated session to a public procedure does NOT produce any audit envelope', async () => {
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: {
        userId: 'lead-1',
        email: 'lead@test.com',
        name: 'Lead User',
        role: 'lead',
        activeReportId: 'r1',
        activeReportSectionId: 's1',
      },
      logger,
      auditLogger,
      ip: '10.0.0.7',
      isPdfExport: false,
      pdfReportId: null,
    });

    const result = await caller.publicRoute();
    expect(result).toBe('public-ok');

    const auditEntries = entries.filter((e) => e.message === 'audit');
    expect(auditEntries).toHaveLength(0);
  });

  it('an unauthenticated call to a head-only procedure surfaces UNAUTHORIZED with NO role-denied emit', async () => {
    // T2 boundary: UNAUTHORIZED (no session) is handled by assertRole's
    // first branch, which throws BEFORE the role check. The factory only
    // emits role-denied when the FORBIDDEN branch fires, so an unauthed
    // call should not pollute the audit channel — the upstream
    // login-fail emit (auth.routes) is the right surface for that.
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: null,
      logger,
      auditLogger,
      ip: '10.0.0.99',
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.headRoute()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    const auditEntries = entries.filter((e) => e.message === 'audit');
    expect(auditEntries).toHaveLength(0);
  });
});
