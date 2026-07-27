import { describe, expect, it } from "vitest";

import { expectDefined } from "../test-utils/expect-defined.js";
import { createAuditLogger, createNullAuditLogger } from "./audit-logger.js";
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

  it("drops unexpected sensitive fields from policy envelopes", () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.policySave({
      ...sensitiveFields,
      userId: "admin-3",
      role: "admin",
      ip: "10.0.0.7",
      policyId: "33333333-3333-4333-8333-333333333330",
      kind: "escalation",
      action: "create",
    });
    audit.policyRemove({
      ...sensitiveFields,
      userId: "admin-3",
      role: "admin",
      ip: "10.0.0.7",
      policyId: "33333333-3333-4333-8333-333333333330",
    });

    expect(entries.map(({ context }) => context)).toEqual([
      {
        event: "admin.policy.save",
        userId: "admin-3",
        role: "admin",
        ip: "10.0.0.7",
        policyId: "33333333-3333-4333-8333-333333333330",
        kind: "escalation",
        action: "create",
      },
      {
        event: "admin.policy.remove",
        userId: "admin-3",
        role: "admin",
        ip: "10.0.0.7",
        policyId: "33333333-3333-4333-8333-333333333330",
      },
    ]);
  });
});

describe("createAuditLogger — organizationUpdate", () => {
  it("emits the complete name transition with admin attribution on info", () => {
    const { logger, entries } = makeCapturingLogger();

    createAuditLogger(logger).organizationUpdate({
      userId: "admin-4",
      role: "admin",
      ip: "10.0.0.8",
      previousShortName: "CD",
      previousFullName: "Software Development",
      nextShortName: "Demo",
      nextFullName: "Example Software Department",
    });

    expect(entries).toEqual([
      {
        level: "info",
        message: "audit",
        context: {
          event: "admin.organization.update",
          userId: "admin-4",
          role: "admin",
          ip: "10.0.0.8",
          previousShortName: "CD",
          previousFullName: "Software Development",
          nextShortName: "Demo",
          nextFullName: "Example Software Department",
        },
      },
    ]);
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
    expect(() =>
      audit.periodManualEdit({
        userId: "admin-1",
        role: "admin",
        ip: "10.0.0.1",
        periodId: "p5",
        changes: { deadline: { from: "a", to: "b" } },
      }),
    ).not.toThrow();
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
      ...sensitiveFields,
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
