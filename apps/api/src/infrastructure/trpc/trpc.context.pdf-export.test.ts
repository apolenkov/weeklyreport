import type { DbRole } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import { createContextFactory } from "./trpc.context";

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
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma repository contract (no awaitable work in the stub)
      findFirst: vi.fn(async () => null),
    },
    // A2 (UAT-v7 2026-05-12): isActive check added to createContextFactory.
    user: {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma repository contract (no awaitable work in the stub)
      findUnique: vi.fn(async () => ({ isActive: true })),
    },
    // UFB-047 / Phase 48-A: see trpc.context.test.ts — the regular session
    // path hydrates `session.organization` from the singleton row before
    // returning. PDF-export-token paths short-circuit before hitting this
    // stub, but the regular-JWT regression test does exercise it.
    organization: {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma repository contract (no awaitable work in the stub)
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

const TEST_REPORT_ID = "11111111-2222-4333-8444-555555555555";
const PDF_SECRET = "phase-32-b1-pdf-export-secret-32-chars-or-more";
const SESSION_SECRET = "integration-test-secret-32-chars-or-more";

describe("createContextFactory — Phase 32-B1 PDF JWT verifier path (H-04)", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", SESSION_SECRET);
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", PDF_SECRET);
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("LEGACY PDF JWT (no requestedBy) → narrow viewer-synthetic session, isPdfExport=true, pdfReportId=X", async () => {
    // Back-compat: tokens minted before the empty-PDF fix carry no
    // `requestedBy` claim. They keep the old narrow viewer-synthetic session
    // (no DB lookup). New tokens carry requestedBy — see the be-the-requester
    // suite below.
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: "pdf-export" },
      PDF_SECRET,
      { expiresIn: "5m" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("viewer");
    expect(ctx.session?.activeReportId).toBe(TEST_REPORT_ID);
    expect(ctx.isPdfExport).toBe(true);
    expect(ctx.pdfReportId).toBe(TEST_REPORT_ID);
  });

  it("PDF JWT signed with the correct secret but missing kind claim → falls through to session=null", async () => {
    // A regular session JWT (signed with SESSION_SECRET, full claim shape)
    // would not pass the PDF verifier even if the secrets accidentally
    // matched — kind disambiguation is the design contract.
    const tokenWithoutKind = jwt.sign(
      { reportId: TEST_REPORT_ID },
      PDF_SECRET,
      { expiresIn: "5m" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(tokenWithoutKind) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
    expect(ctx.pdfReportId).toBeNull();
  });

  it("garbage cookie token → session=null in production (no DEV_SESSION fallthrough)", async () => {
    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq("not-a-real-jwt") as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it("PDF JWT signed with the WRONG secret → rejected, session=null", async () => {
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: "pdf-export" },
      "a-different-secret-32-chars-or-more-haha",
      { expiresIn: "5m" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it("expired PDF JWT → rejected, session=null", async () => {
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: "pdf-export" },
      PDF_SECRET,
      { expiresIn: "-1s" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
  });

  it("regular session JWT still verifies via the session path FIRST and yields isPdfExport=false", async () => {
    const sessionToken = jwt.sign(
      {
        userId: "11111111-2222-4333-8444-aaaaaaaaaaaa",
        email: "head@test.local",
        name: "Head",
        role: "head",
        activeReportId: null,
        activeReportSectionId: null,
      },
      SESSION_SECRET,
      { expiresIn: "1h" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(sessionToken) as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
    expect(ctx.isPdfExport).toBe(false);
    expect(ctx.pdfReportId).toBeNull();
    // 2.2 pin: regular session path must hydrate organization
    expect(ctx.session?.organization).toEqual({
      shortName: "Demo",
      fullName: "Example Software Department",
    });
  });

  it("valid PDF JWT synthetic session does NOT carry organization (Phase 32-B1 no-hydration design)", async () => {
    // PDF-export synthetic sessions intentionally skip hydration
    // (Phase 32-B1; guard middleware + groupScopeFilter own that restriction).
    const token = jwt.sign(
      { reportId: TEST_REPORT_ID, kind: "pdf-export" },
      PDF_SECRET,
      { expiresIn: "5m" },
    );

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.isPdfExport).toBe(true);
    expect(ctx.session?.organization).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// empty-PDF fix: a PDF token with `requestedBy` rebuilds the requester's real
// session so the worker renders /print/<id> scoped to their in-app view. The
// old viewer-synthetic session had no group access → filterSnapshotSections
// scoped to zero sections → an EMPTY PDF for every role.
// ---------------------------------------------------------------------------

const HEAD_REQUESTER_ID = "a1111111-2222-4333-8444-555555555555";
const VIEWER_REQUESTER_ID = "a2222222-3333-4444-8555-666666666666";
const GRANTED_GROUP_ID = "a3333333-4444-4555-8666-777777777777";

interface RequesterUser {
  id: string;
  email: string;
  name: string;
  role: DbRole;
  reportingGroupId: string | null;
}

function makeRequesterPrisma(user: RequesterUser | null) {
  return {
    reportSection: {
      // eslint-disable-next-line @typescript-eslint/require-await -- async Prisma contract; stub has no awaitable work
      findFirst: vi.fn(async () => null),
    },
    user: {
      // eslint-disable-next-line @typescript-eslint/require-await -- async Prisma contract; stub has no awaitable work
      findUnique: vi.fn(async () => user),
    },
    viewerGroupAccess: {
      // eslint-disable-next-line @typescript-eslint/require-await -- async Prisma contract; stub has no awaitable work
      findMany: vi.fn(async () => [{ groupId: GRANTED_GROUP_ID }]),
    },
    reportingGroup: {
      // eslint-disable-next-line @typescript-eslint/require-await -- async Prisma contract; stub has no awaitable work
      findUnique: vi.fn(async () => ({ name: "Software Development" })),
    },
    organization: {
      // eslint-disable-next-line @typescript-eslint/require-await -- async Prisma contract; stub has no awaitable work
      upsert: vi.fn(async () => ({
        shortName: "Demo",
        fullName: "Example Software Department",
      })),
    },
  };
}

describe("createContextFactory — PDF JWT be-the-requester scope (empty-PDF fix)", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", SESSION_SECRET);
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", PDF_SECRET);
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("head requester → session rebuilt AS head (full-report scope), isPdfExport stays true", async () => {
    const token = jwt.sign(
      {
        reportId: TEST_REPORT_ID,
        kind: "pdf-export",
        requestedBy: HEAD_REQUESTER_ID,
      },
      PDF_SECRET,
      { expiresIn: "5m" },
    );
    const prisma = makeRequesterPrisma({
      id: HEAD_REQUESTER_ID,
      email: "head@customreport.local",
      name: "Антон К.",
      role: "head",
      reportingGroupId: GRANTED_GROUP_ID,
    });

    const factory = createContextFactory(
      makeApp(prisma as never),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    // The render session is the head — group-scoping yields the FULL report,
    // not the empty viewer slice.
    expect(ctx.session?.role).toBe("head");
    expect(ctx.session?.userId).toBe(HEAD_REQUESTER_ID);
    expect(ctx.session?.activeReportId).toBe(TEST_REPORT_ID);
    // Guard still binds the read-only allowlist to this reportId.
    expect(ctx.isPdfExport).toBe(true);
    expect(ctx.pdfReportId).toBe(TEST_REPORT_ID);
  });

  it("viewer requester → session rebuilt AS viewer WITH hydrated group access (scoped, NOT empty)", async () => {
    // The discriminating clause: the viewer's export is scoped to their granted
    // groups (non-empty), proving be-the-requester (option B), not all-access.
    const token = jwt.sign(
      {
        reportId: TEST_REPORT_ID,
        kind: "pdf-export",
        requestedBy: VIEWER_REQUESTER_ID,
      },
      PDF_SECRET,
      { expiresIn: "5m" },
    );
    const prisma = makeRequesterPrisma({
      id: VIEWER_REQUESTER_ID,
      email: "viewer@customreport.local",
      name: "Дарья В.",
      role: "viewer",
      reportingGroupId: null,
    });

    const factory = createContextFactory(
      makeApp(prisma as never),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session?.role).toBe("viewer");
    expect(ctx.session?.userId).toBe(VIEWER_REQUESTER_ID);
    // hydrateViewerGroupAccess ran → the snapshot filter sees the viewer's
    // granted groups, so the export renders their sections (not zero).
    expect(ctx.session?.viewerGroupAccess).toEqual([GRANTED_GROUP_ID]);
    expect(ctx.isPdfExport).toBe(true);
  });

  it("requester no longer exists → fail closed (session null, isPdfExport false)", async () => {
    const token = jwt.sign(
      {
        reportId: TEST_REPORT_ID,
        kind: "pdf-export",
        requestedBy: "a9999999-9999-4999-8999-999999999999",
      },
      PDF_SECRET,
      { expiresIn: "5m" },
    );
    const prisma = makeRequesterPrisma(null);

    const factory = createContextFactory(
      makeApp(prisma as never),
      createNullLogger(),
    );
    const ctx = await factory(makeReq(token) as never);

    expect(ctx.session).toBeNull();
    expect(ctx.isPdfExport).toBe(false);
    expect(ctx.pdfReportId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Middleware-level allowlist guard (pdfExportGuard)
// ---------------------------------------------------------------------------

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createAuditLogger } from "../../lib/audit-logger";
import type { TrpcContext } from "./trpc.context";
import {
  anyRoleProcedure,
  headProcedure,
  router as testTrpcRouter,
} from "./trpc.middleware";

describe("pdfExportGuard — Phase 32-B1 PDF synthetic session restrictions", () => {
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
        userId: "a0000000-0000-4000-8000-0000000pdfwk",
        email: "pdf-worker@internal.example.test",
        name: "PDF Worker",
        role: "viewer",
        activeReportId: reportId,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createAuditLogger(createNullLogger()),
      ip: "pdf-worker",
      isPdfExport: true,
      pdfReportId: reportId,
    };
  }

  it("PDF session can call weeklyReport.get for its own reportId", async () => {
    const reportId = "99999999-2222-4333-8444-cccccccccccc";
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    const result = await caller.weeklyReport.get({ reportId });
    expect(result).toEqual({ reportId, ok: true });
  });

  it("PDF session can call archive.detail for its own reportId", async () => {
    const reportId = "99999999-2222-4333-8444-dddddddddddd";
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    const result = await caller.archive.detail({ reportId });
    expect(result).toEqual({ reportId, ok: true });
  });

  it("PDF session for reportId=X CANNOT access weeklyReport.get for reportId=Y", async () => {
    const ctxReportId = "aaaaaaaa-2222-4333-8444-aaaaaaaaaaaa";
    const otherReportId = "bbbbbbbb-2222-4333-8444-bbbbbbbbbbbb";
    const caller = testRouter.createCaller(makePdfCtx(ctxReportId));

    await expect(
      caller.weeklyReport.get({ reportId: otherReportId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("PDF session throws FORBIDDEN for non-allowlisted procedures (admin.users)", async () => {
    const reportId = "99999999-2222-4333-8444-eeeeeeeeeeee";
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    await expect(caller.admin.users()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.admin.users()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("PDF session throws FORBIDDEN for procedures outside the allowlist (weeklyReport.list)", async () => {
    const reportId = "99999999-2222-4333-8444-ffffffffffff";
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    await expect(caller.weeklyReport.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("PDF session throws FORBIDDEN if input has no reportId field", async () => {
    // Defense-in-depth: even if a procedure was added to the allowlist that
    // takes no input, the guard demands an input.reportId match.
    const reportId = "99999999-2222-4333-8444-aaaaaaaaaaab";
    const caller = testRouter.createCaller(makePdfCtx(reportId));

    // archive.list is NOT in the allowlist, but assert the failure shape
    // anyway so we know the guard surfaces FORBIDDEN consistently.
    await expect(caller.archive.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("non-PDF session (isPdfExport=false) is unaffected — head can call admin.users", async () => {
    const headCtx: TrpcContext = {
      session: {
        userId: "a0000000-0000-4000-8000-000000000099",
        email: "head@test.local",
        name: "Head",
        role: "head",
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createAuditLogger(createNullLogger()),
      ip: "test",
      isPdfExport: false,
      pdfReportId: null,
    };
    const caller = testRouter.createCaller(headCtx);

    const result = await caller.admin.users();
    expect(result).toEqual({ ok: true });
  });
});
