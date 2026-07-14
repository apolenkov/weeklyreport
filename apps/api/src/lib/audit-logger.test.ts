import { describe, expect, it } from "vitest";

import { expectDefined } from "../test-utils/expect-defined.js";
import { createAuditLogger, createNullAuditLogger } from "./audit-logger.js";
import type { AppLogger } from "./logger.js";

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
      entries.push({ level, message, context });
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

    // Anonymous events emit role: null (was 'unknown').
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

  // Anonymous events emit role: null (was 'unknown').
  // Lock the contract for SIEM rules tuned to "no session" vs "real
  // role" rather than a literal 'unknown' string.
  it('anonymous logout emits role: null (not the legacy "unknown" literal)', () => {
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
    // Strict guard against regression — must not be the legacy literal.
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

  it("no SAML / cookie / token field can leak into the audit envelope", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginSuccess({
      userId: "u1",
      role: "lead",
      ip: "10.0.0.1",
    });
    audit.roleDenied({
      userId: "u2",
      role: "viewer",
      attemptedRole: "head",
      ip: "10.0.0.4",
    });

    const forbidden = [
      "samlAssertion",
      "nameID",
      "cookie",
      "token",
      "password",
      "authorization",
    ];
    for (const entry of entries) {
      const keys = Object.keys(entry.context ?? {});
      for (const banned of forbidden) {
        expect(keys).not.toContain(banned);
      }
    }
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
    const calls: { level: string; meta: Record<string, unknown> }[] = [];
    const logger: AppLogger = {
      debug: () => {
        /* not used here */
      },
      info: () => {
        /* not used here */
      },
      warn: (_msg: string, meta: Record<string, unknown>) =>
        calls.push({ level: "warn", meta }),
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

describe("createAuditLogger — policySave / policyRemove", () => {
  it("policySave emits {event, userId, role, ip, policyId, kind, action} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.policySave({
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.5",
      policyId: "11111111-1111-4111-8111-111111111110",
      kind: "deadline",
      action: "create",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "admin.policy.save",
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.5",
      policyId: "11111111-1111-4111-8111-111111111110",
      kind: "deadline",
      action: "create",
    });
  });

  it("policySave passes the action through verbatim (update path)", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.policySave({
      userId: "admin-2",
      role: "admin",
      ip: "10.0.0.6",
      policyId: "22222222-2222-4222-8222-222222222220",
      kind: "follow_up",
      action: "update",
    });

    const entry = expectDefined(entries[0]);
    expect(entry.context).toMatchObject({
      event: "admin.policy.save",
      action: "update",
      kind: "follow_up",
    });
  });

  it("policyRemove emits {event, userId, role, ip, policyId} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.policyRemove({
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.5",
      policyId: "11111111-1111-4111-8111-111111111110",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "admin.policy.remove",
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.5",
      policyId: "11111111-1111-4111-8111-111111111110",
    });
  });

  it("PII-safe — no SAML/cookie/token leak through the policy envelope", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.policySave({
      userId: "admin-3",
      role: "admin",
      ip: "10.0.0.7",
      policyId: "33333333-3333-4333-8333-333333333330",
      kind: "escalation",
      action: "create",
    });
    audit.policyRemove({
      userId: "admin-3",
      role: "admin",
      ip: "10.0.0.7",
      policyId: "33333333-3333-4333-8333-333333333330",
    });

    const forbidden = [
      "samlAssertion",
      "nameID",
      "cookie",
      "token",
      "password",
      "authorization",
    ];
    for (const entry of entries) {
      const keys = Object.keys(entry.context ?? {});
      for (const banned of forbidden) {
        expect(keys).not.toContain(banned);
      }
    }
  });
});

describe("createAuditLogger — period.auto-*", () => {
  it("periodAutoCreate emits {event, userId=system, role=null, ip=cron, periodId, dates} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.periodAutoCreate({
      periodId: "00000000-0000-4000-8000-000000000050",
      periodStart: "2026-05-04T00:00:00.000Z",
      periodEnd: "2026-05-10T23:59:59.999Z",
      deadline: "2026-05-08T15:00:00.000Z",
      // State-transition payload. Fresh create has no prior state —
      // `from = null`.
      from: null,
      to: "open",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "period.auto-create",
      userId: "system",
      role: null,
      ip: "cron",
      periodId: "00000000-0000-4000-8000-000000000050",
      periodStart: "2026-05-04T00:00:00.000Z",
      periodEnd: "2026-05-10T23:59:59.999Z",
      deadline: "2026-05-08T15:00:00.000Z",
      from: null,
      to: "open",
    });
  });

  it("periodAutoPublish emits {event, system attribution, periodId, missingSectionsCount} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.periodAutoPublish({
      periodId: "00000000-0000-4000-8000-000000000051",
      missingSectionsCount: 2,
      // State-transition payload.
      from: "open",
      to: "published",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.context).toEqual({
      event: "period.auto-publish",
      userId: "system",
      role: null,
      ip: "cron",
      periodId: "00000000-0000-4000-8000-000000000051",
      missingSectionsCount: 2,
      from: "open",
      to: "published",
    });
  });

  it("periodAutoArchive emits {event, system attribution, periodId} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.periodAutoArchive({
      periodId: "00000000-0000-4000-8000-000000000052",
      // State-transition payload.
      from: "published",
      to: "archived",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.context).toEqual({
      event: "period.auto-archive",
      userId: "system",
      role: null,
      ip: "cron",
      periodId: "00000000-0000-4000-8000-000000000052",
      from: "published",
      to: "archived",
    });
  });

  it("createNullAuditLogger noop branches for the three new events", () => {
    const audit = createNullAuditLogger();
    expect(() =>
      audit.periodAutoCreate({
        periodId: "p1",
        periodStart: "s",
        periodEnd: "e",
        deadline: "d",
        // State-transition payload.
        from: null,
        to: "open",
      }),
    ).not.toThrow();
    expect(() =>
      audit.periodAutoPublish({
        periodId: "p2",
        missingSectionsCount: 0,
        from: "open",
        to: "published",
      }),
    ).not.toThrow();
    expect(() =>
      audit.periodAutoArchive({
        periodId: "p3",
        from: "published",
        to: "archived",
      }),
    ).not.toThrow();
    // Noop branch for the manual-create event.
    expect(() =>
      audit.periodManualCreate({
        userId: "admin-1",
        role: "admin",
        ip: "10.0.0.1",
        periodId: "p4",
        periodStart: "s",
        periodEnd: "e",
        deadline: "d",
        from: null,
        to: "open",
      }),
    ).not.toThrow();
    // Noop branch for the manual-edit event.
    expect(() =>
      audit.periodManualEdit({
        userId: "admin-1",
        role: "admin",
        ip: "10.0.0.1",
        periodId: "p5",
        changes: { deadline: { from: "a", to: "b" } },
      }),
    ).not.toThrow();
    // scope-accessed: noop branch.
    expect(() =>
      audit.scopeAccessed({
        userId: "head-1",
        role: "head",
        ip: "10.0.0.1",
        accessedScope: "weeklyReport.project",
        productIds: ["00000000-0000-4000-8000-000000000001"],
        groupIds: ["00000000-0000-4000-8000-000000000002"],
        resourceId: "00000000-0000-4000-8000-000000000003",
      }),
    ).not.toThrow();
  });

  it("periodManualCreate emits {event, real-user attribution, periodId, dates} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.periodManualCreate({
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.42",
      periodId: "00000000-0000-4000-8000-000000000063",
      periodStart: "2026-05-18T00:00:00.000Z",
      periodEnd: "2026-05-24T23:59:59.999Z",
      deadline: "2026-05-22T15:00:00.000Z",
      from: null,
      to: "open",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "period.manual-create",
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.42",
      periodId: "00000000-0000-4000-8000-000000000063",
      periodStart: "2026-05-18T00:00:00.000Z",
      periodEnd: "2026-05-24T23:59:59.999Z",
      deadline: "2026-05-22T15:00:00.000Z",
      from: null,
      to: "open",
    });
  });

  it("periodManualEdit emits {event, real-user attribution, changes} on info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.periodManualEdit({
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.42",
      periodId: "00000000-0000-4000-8000-000000000067",
      changes: {
        deadline: {
          from: "2026-05-09T15:00:00.000Z",
          to: "2026-05-10T15:00:00.000Z",
        },
        weekLabel: { from: "Sprint 11", to: "Sprint 11 (extended)" },
      },
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "period.manual-edit",
      userId: "admin-1",
      role: "admin",
      ip: "10.0.0.42",
      periodId: "00000000-0000-4000-8000-000000000067",
      changes: {
        deadline: {
          from: "2026-05-09T15:00:00.000Z",
          to: "2026-05-10T15:00:00.000Z",
        },
        weekLabel: { from: "Sprint 11", to: "Sprint 11 (extended)" },
      },
    });
  });
});

describe("createAuditLogger — scopeAccessed", () => {
  it("emits {event, userId, role, ip, accessedScope, productIds, groupIds, resourceId} at info", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.scopeAccessed({
      userId: "head-1",
      role: "head",
      ip: "10.0.0.10",
      accessedScope: "weeklyReport.project",
      productIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      groupIds: ["33333333-3333-4333-8333-333333333333"],
      resourceId: "44444444-4444-4444-8444-444444444444",
    });

    expect(entries).toHaveLength(1);
    const entry = expectDefined(entries[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("audit");
    expect(entry.context).toEqual({
      event: "scope-accessed",
      userId: "head-1",
      role: "head",
      ip: "10.0.0.10",
      accessedScope: "weeklyReport.project",
      productIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      groupIds: ["33333333-3333-4333-8333-333333333333"],
      resourceId: "44444444-4444-4444-8444-444444444444",
    });
    // Whitelist — row contents must never appear on the envelope.
    const banned = [
      "samlAssertion",
      "nameID",
      "cookie",
      "token",
      "password",
      "authorization",
    ];
    for (const key of banned) {
      expect(Object.keys(entry.context ?? {})).not.toContain(key);
    }
  });

  it("no-op logger stays silent and does not throw", () => {
    const audit = createNullAuditLogger();
    expect(() =>
      audit.scopeAccessed({
        userId: "head-1",
        role: "head",
        ip: "10.0.0.10",
        accessedScope: "weeklyReport.project",
        productIds: ["11111111-1111-4111-8111-111111111111"],
        groupIds: ["33333333-3333-4333-8333-333333333333"],
        resourceId: "44444444-4444-4444-8444-444444444444",
      }),
    ).not.toThrow();
  });
});
