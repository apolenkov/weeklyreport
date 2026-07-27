import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  adminProcedure,
  anyRoleProcedure,
  deriveCauseInfo,
  headProcedure,
  leadershipProcedure,
  leadProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  viewerProcedure,
} from "./trpc.middleware.js";

describe("protected procedure chain-composition pins", () => {
  function getChain(proc: {
    query: (fn: () => undefined) => unknown;
  }): unknown[] {
    const built = proc.query(() => undefined) as {
      _def: { middlewares: unknown[] };
    };
    // Drop trailing resolver appended by tRPC
    return built._def.middlewares.slice(0, -1);
  }

  const publicChain = getChain(publicProcedure);
  const protectedChain = getChain(protectedProcedure);
  const headChain = getChain(headProcedure);
  const leadChain = getChain(leadProcedure);
  const viewerChain = getChain(viewerProcedure);
  const anyRoleChain = getChain(anyRoleProcedure);
  const adminChain = getChain(adminProcedure);
  const leadershipChain = getChain(leadershipProcedure);

  const protectedBuilders = [
    { name: "protectedProcedure", chain: protectedChain },
    { name: "headProcedure", chain: headChain },
    { name: "leadProcedure", chain: leadChain },
    { name: "viewerProcedure", chain: viewerChain },
    { name: "anyRoleProcedure", chain: anyRoleChain },
    { name: "adminProcedure", chain: adminChain },
    { name: "leadershipProcedure", chain: leadershipChain },
  ];

  it("each protected builder carries exactly 5 middlewares", () => {
    for (const { name, chain } of protectedBuilders) {
      expect(chain, `${name} middleware count`).toHaveLength(5);
    }
  });

  it("slots 0-1 are reference-equal to publicProcedure's middlewares (metrics + logging)", () => {
    for (const { name, chain } of protectedBuilders) {
      expect(chain[0], `${name} slot 0 (metrics)`).toBe(publicChain[0]);
      expect(chain[1], `${name} slot 1 (logging)`).toBe(publicChain[1]);
    }
  });

  it("slots 3-4 (pdfExportGuard, mutationAuditMiddleware) are reference-equal across all protected builders", () => {
    // Use headProcedure as the reference since the unexported middlewares
    // are not directly accessible.
    for (const { name, chain } of protectedBuilders) {
      expect(chain[3], `${name} slot 3 (pdfExportGuard)`).toBe(headChain[3]);
      expect(chain[4], `${name} slot 4 (mutationAudit)`).toBe(headChain[4]);
    }
  });
});

const nullAuditLogger = createNullAuditLogger();
const TEST_IP = "test-ip";

const testRouter = router({
  publicRoute: publicProcedure.query(() => "public-ok"),
  protectedRoute: protectedProcedure.query(() => "auth-ok"),
  headRoute: headProcedure.query(() => "head-ok"),
});

const nullLogger = createNullLogger();

const nullCaller = testRouter.createCaller({
  session: null,
  logger: nullLogger,
  auditLogger: nullAuditLogger,
  ip: TEST_IP,
  isPdfExport: false,
  pdfReportId: null,
});

const leadCaller = testRouter.createCaller({
  session: {
    userId: "u1",
    email: "lead@test.com",
    name: "Lead User",
    role: "lead" as const,
    activeReportId: "r1",
    activeReportSectionId: "s1",
  },
  logger: nullLogger,
  auditLogger: nullAuditLogger,
  ip: TEST_IP,
  isPdfExport: false,
  pdfReportId: null,
});

const headCaller = testRouter.createCaller({
  session: {
    userId: "u2",
    email: "head@test.com",
    name: "Head User",
    role: "head" as const,
    activeReportId: "r1",
    activeReportSectionId: null,
  },
  logger: nullLogger,
  auditLogger: nullAuditLogger,
  ip: TEST_IP,
  isPdfExport: false,
  pdfReportId: null,
});

function makeFakeLogger(): AppLogger & {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const error = vi.fn();
  const warn = vi.fn();
  const debug = vi.fn();
  const fake = {
    info,
    error,
    warn,
    debug,
    child: () => fake,
  };
  return fake;
}

describe("tRPC auth middleware", () => {
  it("publicProcedure allows null session", async () => {
    const result = await nullCaller.publicRoute();
    expect(result).toBe("public-ok");
  });

  it("protectedProcedure rejects null session with UNAUTHORIZED", async () => {
    await expect(nullCaller.protectedRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Record<
        string,
        unknown
      >,
    );
  });

  it("protectedProcedure allows lead session", async () => {
    const result = await leadCaller.protectedRoute();
    expect(result).toBe("auth-ok");
  });

  it("headProcedure rejects lead session with FORBIDDEN", async () => {
    await expect(leadCaller.headRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: "FORBIDDEN" }) as Record<string, unknown>,
    );
  });

  it("audits a role denial with the attempted role and caller identity", async () => {
    const roleDenied = vi.fn();
    const caller = testRouter.createCaller({
      session: {
        userId: "u1",
        email: "lead@test.com",
        name: "Lead User",
        role: "lead",
        activeReportId: "r1",
        activeReportSectionId: "s1",
      },
      logger: nullLogger,
      auditLogger: { ...nullAuditLogger, roleDenied },
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.headRoute()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(roleDenied).toHaveBeenCalledWith({
      userId: "u1",
      role: "lead",
      attemptedRole: ["head", "admin"],
      ip: TEST_IP,
    });
  });

  it("headProcedure allows head session", async () => {
    const result = await headCaller.headRoute();
    expect(result).toBe("head-ok");
  });

  it("headProcedure rejects null session with UNAUTHORIZED", async () => {
    await expect(nullCaller.headRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Record<
        string,
        unknown
      >,
    );
  });

  it("thrown errors are TRPCError instances", async () => {
    try {
      await nullCaller.protectedRoute();
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
    }
  });

  it("protectedProcedure with null session throws UNAUTHORIZED", async () => {
    await expect(nullCaller.protectedRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Record<
        string,
        unknown
      >,
    );
  });

  it("headProcedure with viewer session throws FORBIDDEN", async () => {
    const viewerCaller = testRouter.createCaller({
      session: {
        userId: "u3",
        email: "viewer@test.com",
        name: "Viewer User",
        role: "viewer" as const,
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: nullLogger,
      auditLogger: nullAuditLogger,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(viewerCaller.headRoute()).rejects.toMatchObject(
      expect.objectContaining({ code: "FORBIDDEN" }) as Record<string, unknown>,
    );
  });

  it("protectedProcedure allows head session", async () => {
    const result = await headCaller.protectedRoute();
    expect(result).toBe("auth-ok");
  });

  it("publicProcedure allows any session type", async () => {
    const result1 = await nullCaller.publicRoute();
    const result2 = await leadCaller.publicRoute();
    const result3 = await headCaller.publicRoute();

    expect(result1).toBe("public-ok");
    expect(result2).toBe("public-ok");
    expect(result3).toBe("public-ok");
  });
});

describe("tRPC logging middleware", () => {
  it("logs entry and exit on a successful query", async () => {
    const logger = makeFakeLogger();
    const caller = testRouter.createCaller({
      session: null,
      logger,
      auditLogger: nullAuditLogger,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    const result = await caller.publicRoute();
    expect(result).toBe("public-ok");

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(logger.info).toHaveBeenCalledTimes(2);

    const [startMsg, startMeta] = expectDefined(logger.info.mock.calls[0]) as [
      unknown,
      Record<string, unknown>,
    ];
    expect(startMsg).toBe("trpc request start");
    expect(startMeta).toMatchObject({
      phase: "trpc.request",
      stage: "start",
      procedure: "publicRoute",
      type: "query",
      userId: null,
    });

    const [endMsg, endMeta] = expectDefined(logger.info.mock.calls[1]) as [
      unknown,
      Record<string, unknown>,
    ];
    expect(endMsg).toBe("trpc request end");
    expect(endMeta).toMatchObject({
      phase: "trpc.request",
      stage: "end",
      procedure: "publicRoute",
      type: "query",
      userId: null,
      status: "success",
    });
    expect(typeof (endMeta as { duration: number }).duration).toBe("number");
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs status:'error' with code+message when a procedure throws", async () => {
    const logger = makeFakeLogger();
    // null session triggers UNAUTHORIZED inside isAuthed, which runs after
    // loggingMiddleware — so we expect the entry log on info() and the exit
    // log on error().
    const caller = testRouter.createCaller({
      session: null,
      logger,
      auditLogger: nullAuditLogger,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.protectedRoute()).rejects.toBeInstanceOf(TRPCError);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(expectDefined(logger.info.mock.calls[0])[1]).toMatchObject({
      stage: "start",
      userId: null,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [endMsg, endMeta] = expectDefined(logger.error.mock.calls[0]) as [
      unknown,
      Record<string, unknown>,
    ];
    expect(endMsg).toBe("trpc request end");
    expect(endMeta).toMatchObject({
      phase: "trpc.request",
      stage: "end",
      procedure: "protectedRoute",
      type: "query",
      userId: null,
      status: "error",
      error: { code: "UNAUTHORIZED" },
    });
    // No stack trace leaks into logs.
    expect(endMeta).not.toHaveProperty("error.stack");
  });

  it("records userId from the session on both entry and exit logs (authed)", async () => {
    const logger = makeFakeLogger();
    const caller = testRouter.createCaller({
      session: {
        userId: "authed-42",
        email: "a@b.c",
        name: "A",
        role: "lead" as const,
        activeReportId: "r1",
        activeReportSectionId: "s1",
      },
      logger,
      auditLogger: nullAuditLogger,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.protectedRoute();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(expectDefined(logger.info.mock.calls[0])[1]).toMatchObject({
      userId: "authed-42",
      stage: "start",
    });
    expect(expectDefined(logger.info.mock.calls[1])[1]).toMatchObject({
      userId: "authed-42",
      stage: "end",
    });
  });

  it("records userId:null for an anonymous public procedure", async () => {
    const logger = makeFakeLogger();
    const caller = testRouter.createCaller({
      session: null,
      logger,
      auditLogger: nullAuditLogger,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.publicRoute();

    expect(expectDefined(logger.info.mock.calls[0])[1]).toMatchObject({
      userId: null,
    });
    expect(expectDefined(logger.info.mock.calls[1])[1]).toMatchObject({
      userId: null,
    });
  });
});

describe("deriveCauseInfo", () => {
  it("surfaces name + message + code + meta for a Prisma-shaped error", () => {
    const prismaError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["email"] },
    });

    expect(deriveCauseInfo(prismaError)).toEqual({
      name: "Error",
      message: "Unique constraint failed",
      causeCode: "P2002",
      causeMeta: { target: ["email"] },
    });
  });

  it("returns only name + message for a plain Error (no code/meta)", () => {
    expect(deriveCauseInfo(new TypeError("boom"))).toEqual({
      name: "TypeError",
      message: "boom",
    });
  });

  it("returns undefined for a non-Error cause", () => {
    expect(deriveCauseInfo("just a string")).toBeUndefined();
    expect(deriveCauseInfo(undefined)).toBeUndefined();
    expect(deriveCauseInfo({ code: "P2002" })).toBeUndefined();
  });
});
