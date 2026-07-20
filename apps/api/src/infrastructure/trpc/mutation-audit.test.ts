import type { UserSession } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import {
  adminProcedure,
  leadProcedure,
  protectedProcedure,
  router,
} from "./trpc.middleware.js";

/**
 * Covers mutation-audit emission, bypasses, failures, target extraction, and
 * persistence.
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

const auditTestRouter = router({
  // Mutation with sectionId in input — target should be extracted.
  saveDraft: leadProcedure
    .input(z.object({ sectionId: z.string(), text: z.string() }))
    .mutation(({ input }) => ({ id: input.sectionId, ok: true })),

  // Mutation that throws — status should be fail with reason.
  failingMutation: leadProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "boom" });
    }),

  // Query — should NOT trigger mutation event.
  queryRoute: protectedProcedure.query(() => "q-ok"),

  // auth.* mutation — should be skipped (covered by login events).
  auth: router({
    fakeMutation: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(() => "auth-ok"),
  }),
  admin: router({
    deactivateUser: userTargetMutation,
    activateUser: userTargetMutation,
    deleteUser: userTargetMutation,
    attachProductToGroup: groupProductTargetMutation,
    detachProductFromGroup: groupProductTargetMutation,
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

function expectAuditTarget(
  mutation: ReturnType<typeof vi.fn>,
  procedure: string,
  target: string,
): void {
  expect(mutation.mock.calls[0]?.[0]).toMatchObject({ procedure, target });
}

describe("mutation-audit middleware", () => {
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
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async Prisma repository contract (no awaitable work in the stub)
    const create = vi.fn(async () => ({}));
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
});
