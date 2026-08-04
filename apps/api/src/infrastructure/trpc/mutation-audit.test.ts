import type { UserSession } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { z } from "zod";

import type { AuditLogger } from "../../lib/audit-logger.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { auditPersistFailuresTotal } from "../metrics/metrics.registry.js";
import {
  adminProcedure,
  leadProcedure,
  protectedProcedure,
  router,
} from "./trpc.middleware.js";

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
    scopeDenied: vi.fn(),
    mutation,
    policySave: vi.fn(),
    policyRemove: vi.fn(),
    organizationUpdate: vi.fn(),
    periodAutoCreate: vi.fn(),
    periodAutoPublish: vi.fn(),
    periodAutoArchive: vi.fn(),
    // emitted only by `admin.createPeriodManual` (router-level audit,
    // parallel to the policySave pattern). Mocked here to satisfy the
    // AuditLogger interface; assertions live in audit-logger.test.ts.
    periodManualCreate: vi.fn(),
    // emitted only by `admin.updatePeriodManual`. Same rationale as the
    // create event above — mocked for interface compliance.
    periodManualEdit: vi.fn(),
    // scope-accessed: emitted at weeklyReport.get — not exercised here.
    scopeAccessed: vi.fn(),
  };
  return { audit, mutation };
}

const nullLogger = createNullLogger();
const TEST_IP = "test-ip";

const leadSession = {
  userId: "u1",
  email: "lead@test.com",
  name: "Lead User",
  role: "lead" as const,
  activeReportId: "r1",
  activeReportSectionId: "s1",
};

const adminSession = {
  userId: "admin-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin" as const,
  activeReportId: null,
  activeReportSectionId: null,
};

const userTargetMutation = adminProcedure
  .input(z.object({ userId: z.uuid() }))
  .mutation(() => "ok");

const groupProductTargetMutation = adminProcedure
  .input(z.object({ groupId: z.uuid(), productId: z.uuid() }))
  .mutation(() => "ok");

const nestedTargetMutation = adminProcedure
  .input(z.object({ data: z.object({ sectionId: z.uuid() }) }))
  .mutation(() => "ok");

const reviewVerdictMutation = adminProcedure
  .input(z.object({ reportSectionId: z.uuid(), verdict: z.string() }))
  .mutation(() => "ok");

const piiFailingMutation = leadProcedure
  .input(z.object({ id: z.string() }))
  .mutation(() => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `duplicate row for person@example.com\n  at Prisma.reportSection.create()\n  where: { stableId: "dup" }`,
    });
  });

const auditTestRouter = router({
  saveDraft: leadProcedure
    .input(z.object({ sectionId: z.string(), text: z.string() }))
    .mutation(({ input }) => ({ id: input.sectionId, ok: true })),

  failingMutation: leadProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "boom" });
    }),

  piiFailingMutation,

  queryRoute: protectedProcedure.query(() => "q-ok"),

  auth: router({
    fakeMutation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(() => "auth-ok"),
  }),
  ai: router({
    fakeMutation: protectedProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(() => "ai-ok"),
  }),
  admin: router({
    deactivateUser: userTargetMutation,
    activateUser: userTargetMutation,
    deleteUser: userTargetMutation,
    attachProductToGroup: groupProductTargetMutation,
    detachProductFromGroup: groupProductTargetMutation,
    nestedTarget: nestedTargetMutation,
    reviewVerdict: reviewVerdictMutation,
  }),
});

function makeAuditCaller(auditLogger: AuditLogger, session: UserSession) {
  return auditTestRouter.createCaller({
    session,
    logger: nullLogger,
    auditLogger,
    ip: TEST_IP,
    isPdfExport: false,
    pdfReportId: null,
  });
}

type SpyLogger = AppLogger & {
  readonly debug: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
  readonly info: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
  readonly warn: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
  readonly error: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
};

function makeSpyLogger(): SpyLogger {
  return {
    debug:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    info: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    error:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    child: () => makeSpyLogger(),
  };
}

function expectAuditTarget(
  mutation: ReturnType<typeof vi.fn>,
  procedure: string,
  target: string,
): void {
  expect(mutation.mock.calls[0]?.[0]).toMatchObject({ procedure, target });
}

describe("mutation-audit middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits exactly one mutation event on a successful authenticated mutation", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await caller.saveDraft({ sectionId: "sec-42", text: "hi" });

    expect(mutation).toHaveBeenCalledTimes(1);
    const call = mutation.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(call).toMatchObject({
      userId: "u1",
      role: "lead",
      ip: TEST_IP,
      procedure: "saveDraft",
      target: "sec-42",
      status: "success",
    });
    expect(typeof call?.duration).toBe("number");
  });

  it("persists a user action log row with the request correlation id", async () => {
    const { audit } = makeAuditSpy();
    const create = vi.fn(() => Promise.resolve({}));
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger: nullLogger,
      correlationId: "req-action-1",
      prisma: { userActionLog: { create } } as never,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.saveDraft({ sectionId: "sec-42", text: "hi" });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        role: "lead",
        procedure: "saveDraft",
        targetId: "sec-42",
        status: "success",
        reason: null,
        ip: TEST_IP,
        correlationId: "req-action-1",
      }) as unknown,
    });
  });

  it("emits status=fail with reason when the mutation throws", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await expect(caller.failingMutation({ id: "thing-1" })).rejects.toThrow();

    expect(mutation).toHaveBeenCalledTimes(1);
    const call = mutation.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(call).toMatchObject({
      procedure: "failingMutation",
      target: "thing-1",
      status: "fail",
      reason: "boom",
    });
  });

  it("does NOT emit a mutation event for a query", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await caller.queryRoute();

    expect(mutation).not.toHaveBeenCalled();
  });

  it("skips auth.* mutations", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await caller.auth.fakeMutation({ id: "b" });

    expect(mutation).not.toHaveBeenCalled();
  });

  it("keeps ai.* prompts out of the audit stream", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await caller.ai.fakeMutation({ prompt: "private prompt" });

    expect(mutation).not.toHaveBeenCalled();
  });

  it.each(["deactivateUser", "activateUser", "deleteUser"] as const)(
    "extracts userId for admin.%s",
    async (procedure) => {
      const { audit, mutation } = makeAuditSpy();
      const caller = makeAuditCaller(audit, adminSession);
      const userId = "00000000-0000-4000-8000-000000000001";

      await caller.admin[procedure]({ userId });

      expectAuditTarget(mutation, `admin.${procedure}`, userId);
    },
  );

  it.each(["attachProductToGroup", "detachProductFromGroup"] as const)(
    "prefers productId for admin.%s",
    async (procedure) => {
      const { audit, mutation } = makeAuditSpy();
      const caller = makeAuditCaller(audit, adminSession);
      const input = {
        groupId: "00000000-0000-4000-8000-000000000002",
        productId: "00000000-0000-4000-8000-000000000003",
      };

      await caller.admin[procedure](input);

      expectAuditTarget(mutation, `admin.${procedure}`, input.productId);
    },
  );

  it("resolves a target nested inside an object, not only at the top level", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, adminSession);
    const sectionId = "00000000-0000-4000-8000-000000000004";

    await caller.admin.nestedTarget({ data: { sectionId } });

    expectAuditTarget(mutation, "admin.nestedTarget", sectionId);
  });

  it("resolves a target for a key the generic set never covered (reportSectionId)", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, adminSession);
    const reportSectionId = "00000000-0000-4000-8000-000000000005";

    await caller.admin.reviewVerdict({
      reportSectionId,
      verdict: "approved",
    });

    expectAuditTarget(mutation, "admin.reviewVerdict", reportSectionId);
  });

  it("carries every resolved identity on the envelope, not just the primary target", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, adminSession);
    const input = {
      groupId: "00000000-0000-4000-8000-000000000002",
      productId: "00000000-0000-4000-8000-000000000003",
    };

    await caller.admin.attachProductToGroup(input);

    const call = mutation.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(call?.target).toBe(input.productId);
    expect(call?.targets).toEqual([input.productId, input.groupId]);
  });

  it("logs a dropped durable audit row as an error and increments the drop metric", async () => {
    const { audit } = makeAuditSpy();
    const create = vi.fn(() => Promise.reject(new Error("db unavailable")));
    const logger = makeSpyLogger();
    const incSpy = vi.spyOn(auditPersistFailuresTotal, "inc");
    const caller = auditTestRouter.createCaller({
      session: leadSession,
      logger,
      prisma: { userActionLog: { create } } as never,
      auditLogger: audit,
      ip: TEST_IP,
      isPdfExport: false,
      pdfReportId: null,
    });

    await caller.saveDraft({ sectionId: "sec-42", text: "hi" });

    expect(create).toHaveBeenCalledOnce();
    expect(incSpy).toHaveBeenCalledOnce();
    const errorLog = logger.error.mock.calls.find(([message]) =>
      message.includes("user action log persist failed"),
    );
    expect(errorLog).toBeDefined();
    expect(errorLog?.[1]).toMatchObject({ phase: "audit.persist" });
    expect(errorLog?.[1]?.error).toEqual({ name: "Error" });
  });

  it("redacts emails, collapses whitespace, and bounds the audit failure reason", async () => {
    const { audit, mutation } = makeAuditSpy();
    const caller = makeAuditCaller(audit, leadSession);

    await expect(
      caller.piiFailingMutation({ id: "thing-1" }),
    ).rejects.toThrow();

    const call = mutation.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    const reason = call?.reason as string | undefined;
    expect(reason).toBeDefined();
    expect(reason).not.toContain("person@example.com");
    expect(reason).toContain("[redacted]");
    expect(reason).not.toContain("\n");
    expect(reason).not.toContain("  at Prisma");
  });
});
