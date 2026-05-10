import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { INestApplication } from '@nestjs/common';

import { createContextFactory } from './trpc.context';
import { createNullLogger } from '../../lib/logger';

/**
 * Phase 32-B1 (H-04) — PDF JWT verifier path on the receiving end.
 *
 * Asserts that:
 *   1. A valid PDF-export JWT (kind='pdf-export', reportId=X) produces a
 *      synthetic session with isPdfExport=true and pdfReportId=X.
 *   2. A token signed with PDF_EXPORT_JWT_SECRET but missing the `kind`
 *      claim is rejected (would otherwise allow session-jwt impersonation
 *      if both secrets accidentally match).
 *   3. A garbage token falls through to session=null in production
 *      (AUTH_DEV_MODE off + AUTH_DEV_MODE_ALLOW_TEST off).
 *   4. A PDF token with reportId=X cannot be reused after secret rotation
 *      (verifier rejects when secret mismatches).
 *
 * The middleware-level allowlist (only weeklyReport.get + archive.detail
 * with input.reportId === pdfReportId) is exercised via a separate caller
 * test below using the testRouter helper.
 */

interface MockNestApp {
  get: () => unknown;
}

function makePrismaStub() {
  return {
    reportSection: {
      findFirst: vi.fn(async () => null),
    },
    // UFB-047 / Phase 48-A: see trpc.context.test.ts — the regular session
    // path hydrates `session.organization` from the singleton row before
    // returning. PDF-export-token paths short-circuit before hitting this
    // stub, but the regular-JWT regression test does exercise it.
    organization: {
      upsert: vi.fn(async () => ({
        shortName: "Demo",
        fullName: "Example Software Department",
      })),
    },
  };
}

function makeApp(prisma: ReturnType<typeof makePrismaStub>): INestApplication {
  const app: MockNestApp = {
    get: () => prisma,
  };
  return app as unknown as INestApplication;
}

function makeReq(cookieToken?: string): { req: Request } {
  const req = {
    cookies: cookieToken ? { customreport_session: cookieToken } : {},
  } as unknown as Request;
  return { req };
}

const TEST_REPORT_ID = '11111111-2222-4333-8444-555555555555';
const PDF_SECRET = 'phase-32-b1-pdf-export-secret-32-chars-or-more';
const SESSION_SECRET = 'integration-test-secret-32-chars-or-more';

describe('createContextFactory — Phase 32-B1 PDF JWT verifier path (H-04)', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_JWT_SECRET', SESSION_SECRET);
    vi.stubEnv('PDF_EXPORT_JWT_SECRET', PDF_SECRET);
    vi.stubEnv('AUTH_DEV_MODE', 'false');
    vi.stubEnv('AUTH_DEV_MODE_ALLOW_TEST', 'false');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('valid PDF JWT (kind=pdf-export, reportId=X) → synthetic viewer session with isPdfExport=true and pdfReportId=X', async () => {
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: 'pdf-export' },
      PDF_SECRET,
      { expiresIn: '5m' },
    );

    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe('viewer');
    expect(ctx.session?.activeReportId).toBe(TEST_REPORT_ID);
    expect(ctx.isPdfExport).toBe(true);
    expect(ctx.pdfReportId).toBe(TEST_REPORT_ID);
  });

  it('PDF JWT signed with the correct secret but missing kind claim → falls through to session=null', async () => {
    // A regular session JWT (signed with SESSION_SECRET, full claim shape)
    // would not pass the PDF verifier even if the secrets accidentally
    // matched — kind disambiguation is the design contract.
    const tokenWithoutKind = jwt.sign(
      { reportId: TEST_REPORT_ID },
      PDF_SECRET,
      { expiresIn: '5m' },
    );

    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq(tokenWithoutKind) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
    expect(ctx.pdfReportId).toBeNull();
  });

  it('garbage cookie token → session=null in production (no DEV_SESSION fallthrough)', async () => {
    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq('not-a-real-jwt') as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it('PDF JWT signed with the WRONG secret → rejected, session=null', async () => {
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: 'pdf-export' },
      'a-different-secret-32-chars-or-more-haha',
      { expiresIn: '5m' },
    );

    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it('expired PDF JWT → rejected, session=null', async () => {
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: 'pdf-export' },
      PDF_SECRET,
      { expiresIn: '-1s' },
    );

    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it('regular session JWT still verifies via the session path FIRST and yields isPdfExport=false', async () => {
    const sessionToken = jwt.sign(
      {
        userId: '11111111-2222-4333-8444-aaaaaaaaaaaa',
        email: 'head@test.local',
        name: 'Head',
        role: 'head',
        activeReportId: null,
        activeReportSectionId: null,
      },
      SESSION_SECRET,
      { expiresIn: '1h' },
    );

    const factory = createContextFactory(makeApp(makePrismaStub()), createNullLogger());
    const ctx = await factory(makeReq(sessionToken) as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe('head');
    expect(ctx.isPdfExport).toBe(false);
    expect(ctx.pdfReportId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Middleware-level allowlist guard (pdfExportGuard)
// ---------------------------------------------------------------------------

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createAuditLogger } from '../../lib/audit-logger';
import {
  router as testTrpcRouter,
  anyRoleProcedure,
  headProcedure,
} from './trpc.middleware';
import type { TrpcContext } from './trpc.context';

describe('pdfExportGuard — Phase 32-B1 PDF synthetic session restrictions', () => {
  // We rebuild a tiny router exposing the same procedure helpers so we can
  // exercise the guard without spinning up the full app router. The
  // procedure helpers wire pdfExportGuard into the chain at module load
  // time, so calling testRouter.createCaller with isPdfExport=true
  // exercises the guard end-to-end.
  const testRouter = testTrpcRouter({
    weeklyReport: testTrpcRouter({
      get: anyRoleProcedure
        .input(z.object({ reportId: z.string() }))
        .query(({ input }) => ({ reportId: input.reportId, ok: true })),
      list: anyRoleProcedure.query(() => ({ ok: true })),
    }),
    archive: testTrpcRouter({
      detail: anyRoleProcedure
        .input(z.object({ reportId: z.string() }))
        .query(({ input }) => ({ reportId: input.reportId, ok: true })),
      list: anyRoleProcedure.query(() => ({ ok: true })),
    }),
    admin: testTrpcRouter({
      users: headProcedure.query(() => ({ ok: true })),
    }),
  });

  function makePdfCtx(reportId: string): TrpcContext {
    return {
      session: {
        userId: 'a0000000-0000-4000-8000-0000000pdfwk',
        email: 'pdf-worker@internal.example.test',
        name: 'PDF Worker',
        role: 'viewer',
        activeReportId: reportId,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createAuditLogger(createNullLogger()),
      ip: 'pdf-worker',
      isPdfExport: true,
      pdfReportId: reportId,
    };
  }

  it('PDF session can call weeklyReport.get for its own reportId', async () => {
    const reportId = '99999999-2222-4333-8444-cccccccccccc';
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    const result = await caller.weeklyReport.get({ reportId });
    expect(result).toEqual({ reportId, ok: true });
  });

  it('PDF session can call archive.detail for its own reportId', async () => {
    const reportId = '99999999-2222-4333-8444-dddddddddddd';
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    const result = await caller.archive.detail({ reportId });
    expect(result).toEqual({ reportId, ok: true });
  });

  it('PDF session for reportId=X CANNOT access weeklyReport.get for reportId=Y', async () => {
    const ctxReportId = 'aaaaaaaa-2222-4333-8444-aaaaaaaaaaaa';
    const otherReportId = 'bbbbbbbb-2222-4333-8444-bbbbbbbbbbbb';
    const caller = testRouter.createCaller(makePdfCtx(ctxReportId));

    await expect(
      caller.weeklyReport.get({ reportId: otherReportId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('PDF session throws FORBIDDEN for non-allowlisted procedures (admin.users)', async () => {
    const reportId = '99999999-2222-4333-8444-eeeeeeeeeeee';
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    await expect(caller.admin.users()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.admin.users()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('PDF session throws FORBIDDEN for procedures outside the allowlist (weeklyReport.list)', async () => {
    const reportId = '99999999-2222-4333-8444-ffffffffffff';
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    await expect(caller.weeklyReport.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('PDF session throws FORBIDDEN if input has no reportId field', async () => {
    // Defense-in-depth: even if a procedure was added to the allowlist that
    // takes no input, the guard demands an input.reportId match.
    const reportId = '99999999-2222-4333-8444-aaaaaaaaaaab';
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    // archive.list is NOT in the allowlist, but assert the failure shape
    // anyway so we know the guard surfaces FORBIDDEN consistently.
    await expect(caller.archive.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('non-PDF session (isPdfExport=false) is unaffected — head can call admin.users', async () => {
    const headCtx: TrpcContext = {
      session: {
        userId: 'a0000000-0000-4000-8000-000000000099',
        email: 'head@test.local',
        name: 'Head',
        role: 'head',
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createAuditLogger(createNullLogger()),
      ip: 'test',
      isPdfExport: false,
      pdfReportId: null,
    };
    const caller = testRouter.createCaller(headCtx);

    const result = await caller.admin.users();
    expect(result).toEqual({ ok: true });
  });
});
