import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  type AuditLogger,
  createAuditLogger,
} from "../../../lib/audit-logger.js";
import type { AppLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { headProcedure, publicProcedure, router } from "../trpc.middleware.js";

// Locks the invariant that role-denied audit fires inside the role-middleware
// factory, not only at controller seams — future deny paths inherit it.
interface Captured {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  context?: Record<string, unknown>;
}

function makeCapturingLogger(): { logger: AppLogger; entries: Captured[] } {
  const entries: Captured[] = [];
  const push =
    (level: Captured["level"]) =>
    (message: string, context?: Record<string, unknown>) => {
      entries.push({
        level,
        message,
        ...(context === undefined ? {} : { context }),
      });
    };
  const logger: AppLogger = {
    debug: push("debug"),
    info: push("info"),
    warn: push("warn"),
    error: push("error"),
    child() {
      return logger;
    },
  };
  return { logger, entries };
}

const testRouter = router({
  publicRoute: publicProcedure.query(() => "public-ok"),
  headRoute: headProcedure.query(() => "head-ok"),
});

describe("role-denied integration signal", () => {
  it("a viewer call to a head-only procedure produces exactly one role-denied envelope", async () => {
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: {
        userId: "viewer-1",
        email: "viewer@test.com",
        name: "Viewer User",
        role: "viewer",
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger,
      auditLogger,
      ip: "10.0.0.42",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.headRoute()).rejects.toBeInstanceOf(TRPCError);

    const auditEntries = entries.filter((e) => e.message === "audit");
    expect(auditEntries).toHaveLength(1);

    const audit = expectDefined(auditEntries[0]);
    expect(audit.level).toBe("warn");
    expect(audit.context).toMatchObject({
      event: "role-denied",
      userId: "viewer-1",
      role: "viewer",
      ip: "10.0.0.42",
    });

    // attemptedRole carries the allowed Role | Role[] verbatim. headProcedure
    // accepts ['head', 'admin'] (admin inherits head capabilities).
    // adminProcedure is a separate procedure (admin-only), not a headProcedure alias.
    expect(audit.context?.attemptedRole).toEqual(["head", "admin"]);

    // Negative — no spurious login-success was emitted by the role-deny path.
    const loginSuccesses = entries.filter(
      (e) => e.context?.event === "login-success",
    );
    expect(loginSuccesses).toHaveLength(0);
  });

  it("an authenticated session to a public procedure does NOT produce any audit envelope", async () => {
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: {
        userId: "lead-1",
        email: "lead@test.com",
        name: "Lead User",
        role: "lead",
        activeReportId: "r1",
        activeReportSectionId: "s1",
      },
      logger,
      auditLogger,
      ip: "10.0.0.7",
      isPdfExport: false,
      pdfReportId: null,
    });

    const result = await caller.publicRoute();
    expect(result).toBe("public-ok");

    const auditEntries = entries.filter((e) => e.message === "audit");
    expect(auditEntries).toHaveLength(0);
  });

  it("an unauthenticated call to a head-only procedure surfaces UNAUTHORIZED with NO role-denied emit", async () => {
    // assertRole throws UNAUTHORIZED before the role check; role-denied only
    // fires on FORBIDDEN. Unauthed noise belongs on the login-fail path.
    const { logger, entries } = makeCapturingLogger();
    const auditLogger: AuditLogger = createAuditLogger(logger);

    const caller = testRouter.createCaller({
      session: null,
      logger,
      auditLogger,
      ip: "10.0.0.99",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.headRoute()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const auditEntries = entries.filter((e) => e.message === "audit");
    expect(auditEntries).toHaveLength(0);
  });
});
