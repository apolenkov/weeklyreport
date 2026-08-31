import { describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../test-utils/audit-logger.js";
import { expectDefined } from "../test-utils/expect-defined.js";
import { createAuditLogger } from "./audit-logger.js";
import type { AppLogger } from "./logger.js";

interface Captured {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  context?: Record<string, unknown>;
}

const sensitiveFields = {
  samlAssertion: "signed-assertion",
  nameID: "person@example.com",
  cookie: "session=secret",
  token: "bearer-token",
  password: "secret",
  authorization: "Bearer secret",
};

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

describe("createAuditLogger", () => {
  it("loginSuccess emits exactly the {event, userId, role, ip} envelope on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginSuccess({
      userId: "u1",
      role: "lead",
      ip: "10.0.0.1",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "login-success",
      userId: "u1",
      role: "lead",
      ip: "10.0.0.1",
    });
    // Whitelist enforced — attemptedRole MUST NOT appear on a login-success
    // envelope; the type system blocks it at compile time and the
    // implementation never spreads extra keys.
    expect(Object.keys(entry.context ?? {})).not.toContain("attemptedRole");
  });

  it("roleDenied emits the {event, userId, role, attemptedRole, ip} envelope on warn", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.roleDenied({
      userId: "viewer-1",
      role: "viewer",
      attemptedRole: ["head"],
      ip: "10.0.0.2",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "role-denied",
      userId: "viewer-1",
      role: "viewer",
      attemptedRole: ["head"],
      ip: "10.0.0.2",
    });
  });

  it("loginFail carries the reason and emits on warn", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginFail({
      userId: "anonymous",
      role: null,
      ip: "10.0.0.3",
      reason: "token-verify-failed",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("warn");
    expect(entry.context).toEqual({
      event: "login-fail",
      userId: "anonymous",
      role: null,
      ip: "10.0.0.3",
      reason: "token-verify-failed",
    });
  });

  // SIEM rules distinguish "no session" (null) from a real role string.
  it("anonymous logout emits the canonical null role", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.logout({
      userId: "anonymous",
      role: null,
      ip: "10.0.0.5",
    });

    expect(entries).toHaveLength(1);
    expect(expectDefined(entries[0]).level).toBe("info");
    expect(expectDefined(entries[0]).context).toEqual({
      event: "logout",
      userId: "anonymous",
      role: null,
      ip: "10.0.0.5",
    });
    expect(expectDefined(entries[0]).context?.role).not.toBe("unknown");
  });

  it("logout emits {event, userId, role, ip} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.logout({
      userId: "u9",
      role: "head",
      ip: "127.0.0.1",
    });

    expect(entries).toHaveLength(1);
    expect(expectDefined(entries[0]).level).toBe("info");
    expect(expectDefined(entries[0]).context).toEqual({
      event: "logout",
      userId: "u9",
      role: "head",
      ip: "127.0.0.1",
    });
  });

  it("drops unexpected sensitive fields instead of spreading caller input", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginSuccess({
      ...sensitiveFields,
      userId: "u1",
      role: "lead",
      ip: "10.0.0.1",
    });
    audit.roleDenied({
      ...sensitiveFields,
      userId: "u2",
      role: "viewer",
      attemptedRole: "head",
      ip: "10.0.0.4",
    });

    expect(entries.map(({ context }) => context)).toEqual([
      {
        event: "login-success",
        userId: "u1",
        role: "lead",
        ip: "10.0.0.1",
      },
      {
        event: "role-denied",
        userId: "u2",
        role: "viewer",
        attemptedRole: "head",
        ip: "10.0.0.4",
      },
    ]);
  });
});

describe("audit.mutation", () => {
  const mutationInput = {
    userId: "u1",
    role: "lead" as const,
    ip: "10.0.0.1",
    procedure: "reportSection.save",
    target: "section-1",
    duration: 12,
  };

  it("logs a successful mutation at info without a reason key", () => {
    const { logger, entries } = makeCapturingLogger();

    createAuditLogger(logger).mutation({
      ...mutationInput,
      status: "success",
    });

    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.context).toEqual({
      event: "mutation",
      ...mutationInput,
      status: "success",
    });
    expect(entry.context).not.toHaveProperty("reason");
  });

  it("omits target from the envelope when none is supplied", () => {
    const { logger, entries } = makeCapturingLogger();

    createAuditLogger(logger).mutation({
      userId: mutationInput.userId,
      role: mutationInput.role,
      ip: mutationInput.ip,
      procedure: mutationInput.procedure,
      duration: mutationInput.duration,
      status: "success",
    });

    expect(expectDefined(entries[0]).context).not.toHaveProperty("target");
  });

  it("logs a failed mutation at warn with its reason", () => {
    const { logger, entries } = makeCapturingLogger();

    createAuditLogger(logger).mutation({
      ...mutationInput,
      status: "fail",
      reason: "conflict",
    });

    expect(expectDefined(entries[0])).toMatchObject({
      level: "warn",
      context: {
        event: "mutation",
        ...mutationInput,
        status: "fail",
        reason: "conflict",
      },
    });
  });
});

describe("createNullAuditLogger", () => {
  it("all methods are no-ops and do not throw", () => {
    const audit = createNullAuditLogger();
    expect(() =>
      audit.loginSuccess({ userId: "u", role: "lead", ip: "x" }),
    ).not.toThrow();
    expect(() =>
      audit.loginFail({ userId: "u", role: null, ip: "x", reason: "r" }),
    ).not.toThrow();
    expect(() =>
      audit.logout({ userId: "u", role: "lead", ip: "x" }),
    ).not.toThrow();
    expect(() =>
      audit.roleDenied({
        userId: "u",
        role: "viewer",
        attemptedRole: "head",
        ip: "x",
      }),
    ).not.toThrow();
    expect(() =>
      audit.scopeDenied({
        userId: "u",
        role: "viewer",
        ip: "x",
        attemptedScope: "report",
        resourceId: "00000000-0000-4000-8000-000000000001",
      }),
    ).not.toThrow();
    // Null logger must accept the policy helpers without throwing — same
    // contract as the live impl.
    expect(() =>
      audit.policySave({
        userId: "u",
        role: "admin",
        ip: "x",
        policyId: "00000000-0000-4000-8000-000000000010",
        kind: "deadline",
        action: "create",
      }),
    ).not.toThrow();
    expect(() =>
      audit.policyRemove({
        userId: "u",
        role: "admin",
        ip: "x",
        policyId: "00000000-0000-4000-8000-000000000010",
      }),
    ).not.toThrow();
  });
});

describe("createAuditLogger — scopeDenied", () => {
  it("emits the {event, userId, role, ip, attemptedScope, resourceId} envelope on warn", () => {
    const calls: { level: string; meta?: Record<string, unknown> }[] = [];
    const logger: AppLogger = {
      debug: () => {
        /* not used here */
      },
      info: () => {
        /* not used here */
      },
      warn: (_msg: string, meta?: Record<string, unknown>) => {
        calls.push({
          level: "warn",
          ...(meta === undefined ? {} : { meta }),
        });
      },
      error: () => {
        /* not used here */
      },
      child: () => logger,
    };

    const audit = createAuditLogger(logger);
    audit.scopeDenied({
      userId: "u-viewer",
      role: "viewer",
      ip: "10.0.0.1",
      attemptedScope: "report",
      resourceId: "11111111-1111-4111-8111-111111111111",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      level: "warn",
      meta: {
        event: "scope-denied",
        userId: "u-viewer",
        role: "viewer",
        ip: "10.0.0.1",
        attemptedScope: "report",
        resourceId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });
});
