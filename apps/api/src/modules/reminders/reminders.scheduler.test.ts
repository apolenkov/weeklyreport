import type {
  AdminReminderExecution,
  AdminReminderRule,
} from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeRule,
  createServiceRepo,
  dueRuleFromRecipients,
  fakeOrganizationService,
  reportDeadline,
  reportId,
  ruleId,
  schedulerTestEnv,
} from "./__tests__/reminders-scheduler-harness.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";
import type {
  DueDeadlineRule,
  DueEscalationRule,
  RemindersRepository,
} from "./reminders.types";

describe("RemindersScheduler — deadline reminder dispatch", () => {
  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { enqueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      enqueue: vi.fn(
        (
          _executionId: string,
          data: Record<string, unknown>,
          context: Record<string, unknown>,
        ) => {
          queueAdds.push({ name: "send", data: { ...data, ...context } });
          return Promise.resolve();
        },
      ),
    };
  });

  it("one lead gets one email per non-24h policy cycle (repeated tick is idempotent)", async () => {
    const recipients = [
      { userId: "u1", email: "lead@test.local", name: "Lead Alpha" },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() =>
        Promise.resolve([dueRuleFromRecipients(recipients)]),
      ),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    // Tick #1 is after fireAt but well before the independent report deadline.
    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.kind).toBe("deadline");
    expect(queueAdds[0]?.data.recipientEmail).toBe("lead@test.local");

    // Tick #2 at 17:00 UTC — same UTC day. Idempotent — service deduplicates
    // on the same `${rule.id}:deadline:${cycleDate}:${email}` key.
    await scheduler.runOnce(new Date("2026-04-19T17:00:00.000Z"));
    expect(queueAdds).toHaveLength(1); // STILL one — second tick was a no-op
  });

  it("the next automatic tick never revives a terminal failed execution", async () => {
    const recipient = {
      userId: "u1",
      email: "lead@test.local",
      name: "Lead Alpha",
    };
    const failed: AdminReminderExecution = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ruleId,
      reportId,
      dedupeKey: `${ruleId}:deadline:2026-04-19:${recipient.email}`,
      status: "failed",
      scheduledFor: activeRule.fireAt,
      sentAt: null,
      recipientEmail: recipient.email,
      errorMessage: "SMTP refused",
    };
    const recordExecution = vi.fn().mockResolvedValue({
      execution: failed,
      outcome: "deduplicated" as const,
    });
    const service = new RemindersService(
      createServiceRepo({
        insertExecutionOnConflict: recordExecution,
      }),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      {
        findDueDeadlineRules: vi.fn(() =>
          Promise.resolve([dueRuleFromRecipients([recipient])]),
        ),
        findDueEscalationRules: vi.fn(() => Promise.resolve([])),
      },
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:00:00.000Z"));

    expect(recordExecution).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
    );
    expect(queueAdds).toHaveLength(0);
  });

  it("no lead with draft section → zero emails", async () => {
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([])),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    expect(queueAdds).toHaveLength(0);
  });

  it("multiple leads in the same cycle → one email per lead", async () => {
    const recipients = [
      { userId: "u1", email: "a@test.local", name: "Alpha" },
      { userId: "u2", email: "b@test.local", name: "Beta" },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() =>
        Promise.resolve([dueRuleFromRecipients(recipients)]),
      ),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    expect(queueAdds).toHaveLength(2);
    const emails = queueAdds.map((q) => q.data.recipientEmail);
    expect(emails).toContain("a@test.local");
    expect(emails).toContain("b@test.local");
  });

  it('queue payload carries the rich kind="deadline" shape (leadName, reportPeriod, sectionUrl)', async () => {
    const recipients = [
      { userId: "u1", email: "lead@test.local", name: "Lead Alpha" },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() =>
        Promise.resolve([dueRuleFromRecipients(recipients)]),
      ),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    const data = queueAdds[0]?.data ?? {};
    expect(data.kind).toBe("deadline");
    expect(data.leadName).toBe("Lead Alpha");
    expect(data.reportPeriod).toBe("2026-04-13 → 2026-04-19");
    expect(data.deadlineIso).toBe(reportDeadline.toISOString());
    expect(data.deadlineIso).not.toBe(activeRule.fireAt.toISOString());
    expect(data.sectionUrl).toBe(
      `${schedulerTestEnv.APP_BASE_URL}/lead/report/${reportId}`,
    );
  });

  it("builds sectionUrl from the injected APP_BASE_URL, not raw process.env", async () => {
    const originalBaseUrl = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://env-would-win.example";
    try {
      const recipients = [
        { userId: "u1", email: "lead@test.local", name: "Lead Alpha" },
      ];
      const fakeRepository = {
        findDueDeadlineRules: vi.fn(() =>
          Promise.resolve([dueRuleFromRecipients(recipients)]),
        ),
        findDueEscalationRules: vi.fn(() => Promise.resolve([])),
      };
      const service = new RemindersService(
        createServiceRepo(),
        undefined,
        fakeQueue as unknown as ConstructorParameters<
          typeof RemindersService
        >[2],
      );
      const scheduler = new RemindersScheduler(
        service,
        fakeRepository,
        fakeOrganizationService,
        schedulerTestEnv,
      );

      await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

      const data = queueAdds[0]?.data ?? {};
      expect(String(data.sectionUrl)).toContain(schedulerTestEnv.APP_BASE_URL);
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.APP_BASE_URL;
      } else {
        process.env.APP_BASE_URL = originalBaseUrl;
      }
    }
  });

  it("two cycles: same lead in cycle N and N+1 receives two distinct emails", async () => {
    const recipients = [
      { userId: "u1", email: "lead@test.local", name: "Lead Alpha" },
    ];
    // Cycle N — fireAt 2026-04-19.
    const ruleN: DueDeadlineRule = dueRuleFromRecipients(recipients);
    // Cycle N+1 — different rule id and fireAt 2026-04-26 (a week later).
    const ruleNplus1: DueDeadlineRule = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      reportId,
      fireAt: new Date("2026-04-26T15:00:00.000Z"),
      deadline: new Date("2026-04-28T09:00:00.000Z"),
      reportPeriodLabel: "2026-04-20 → 2026-04-26",
      recipients: recipients.map((r) => ({ ...r, notificationOptOut: false })),
    };

    let returnNplus1 = false;
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() =>
        Promise.resolve(returnNplus1 ? [ruleNplus1] : [ruleN]),
      ),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };

    const serviceRepo = createServiceRepo({
      getRule: (rid: string) =>
        Promise.resolve(
          rid === ruleNplus1.id
            ? {
                ...activeRule,
                id: ruleNplus1.id,
                fireAt: ruleNplus1.fireAt,
              }
            : rid === activeRule.id
              ? structuredClone(activeRule)
              : null,
        ),
    });

    const service = new RemindersService(
      serviceRepo,
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(1);

    returnNplus1 = true;
    await scheduler.runOnce(new Date("2026-04-26T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(2);
  });
});

describe("RemindersScheduler — escalation dispatch", () => {
  const escalationRuleId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const escalationActiveRule: AdminReminderRule = {
    id: escalationRuleId,
    reportId,
    kind: "escalation",
    fireAt: new Date("2026-04-19T17:00:00.000Z"), // T+2h after deadline
    timezone: "UTC",
    status: "active",
    version: 1,
    policyId: "99999999-9999-4999-8999-999999999999",
  };

  function makeEscalationRule(
    leads: {
      leadName: string;
      sectionTitle: string;
      deadlineIso: string;
    }[],
  ): DueEscalationRule {
    return {
      id: escalationRuleId,
      reportId,
      fireAt: escalationActiveRule.fireAt,
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      groups: [
        {
          head: {
            userId: "h1",
            email: "head@test.local",
            name: "Department Head",
          },
          lateLeads: leads,
        },
      ],
    };
  }

  function makeEscalationServiceRepo(): RemindersRepository {
    const executions = new Map<string, AdminReminderExecution>();
    return {
      ...unusedRemindersRepositoryStubs(),
      getRule(rid) {
        return Promise.resolve(
          rid === escalationRuleId
            ? structuredClone(escalationActiveRule)
            : null,
        );
      },
      findExecutionByDedupeKey(dedupeKey) {
        for (const exec of executions.values()) {
          if (exec.dedupeKey === dedupeKey)
            return Promise.resolve(structuredClone(exec));
        }
        return Promise.resolve(null);
      },
      insertExecutionOnConflict(execution) {
        for (const exec of executions.values()) {
          if (exec.dedupeKey === execution.dedupeKey) {
            return Promise.resolve({
              execution: structuredClone(exec),
              outcome: "deduplicated" as const,
            });
          }
        }
        executions.set(execution.id, structuredClone(execution));
        return Promise.resolve({
          execution: structuredClone(execution),
          outcome: "created" as const,
        });
      },
      getExecution(id) {
        return Promise.resolve(executions.get(id) ?? null);
      },
      listExecutions(rid) {
        return Promise.resolve(
          [...executions.values()].filter((e) => e.ruleId === rid),
        );
      },
    };
  }

  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { enqueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      enqueue: vi.fn(
        (
          _executionId: string,
          data: Record<string, unknown>,
          context: Record<string, unknown>,
        ) => {
          queueAdds.push({ name: "send", data: { ...data, ...context } });
          return Promise.resolve();
        },
      ),
    };
  });

  it("head with N late leads gets exactly ONE digest email per cycle (twice-fired tick is idempotent)", async () => {
    const lateLeads = [
      {
        leadName: "Alpha",
        sectionTitle: "Backend",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
      {
        leadName: "Beta",
        sectionTitle: "Frontend",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
      {
        leadName: "Gamma",
        sectionTitle: "Infra",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([])),
      findDueEscalationRules: vi.fn(() =>
        Promise.resolve([makeEscalationRule(lateLeads)]),
      ),
    };

    const service = new RemindersService(
      makeEscalationServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    // Tick #1 — same UTC day as escalation fireAt.
    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));
    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.kind).toBe("escalation");
    expect(queueAdds[0]?.data.recipientEmail).toBe("head@test.local");
    const lateLeadsInJob = queueAdds[0]?.data.lateLeads as {
      leadName: string;
    }[];
    expect(lateLeadsInJob).toHaveLength(3);
    expect(lateLeadsInJob.map((l) => l.leadName)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);

    // Tick #2 — same UTC day. Idempotent — service deduplicates on
    // `${rule.id}:escalation:${cycleDate}:${head.email}`.
    await scheduler.runOnce(new Date("2026-04-19T18:30:00.000Z"));
    expect(queueAdds).toHaveLength(1);
  });

  it("escalation digest carries headName, cycleDate, reportPeriod", async () => {
    const lateLeads = [
      {
        leadName: "Alpha",
        sectionTitle: "Backend",
        deadlineIso: "2026-04-19T15:00:00.000Z",
      },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([])),
      findDueEscalationRules: vi.fn(() =>
        Promise.resolve([makeEscalationRule(lateLeads)]),
      ),
    };
    const service = new RemindersService(
      makeEscalationServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));

    const data = queueAdds[0]?.data ?? {};
    expect(data.headName).toBe("Department Head");
    expect(data.cycleDate).toBe("2026-04-19");
    expect(data.reportPeriod).toBe("2026-04-13 → 2026-04-19");
  });

  it("fans out one digest per group head, each carrying only its group's leads", async () => {
    const twoGroupRule: DueEscalationRule = {
      id: escalationRuleId,
      reportId,
      fireAt: escalationActiveRule.fireAt,
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      groups: [
        {
          head: { userId: "h1", email: "head-a@test.local", name: "Head A" },
          lateLeads: [
            {
              leadName: "Alpha",
              sectionTitle: "Backend",
              deadlineIso: "2026-04-19T15:00:00.000Z",
            },
          ],
        },
        {
          head: { userId: "h2", email: "head-b@test.local", name: "Head B" },
          lateLeads: [
            {
              leadName: "Beta",
              sectionTitle: "Frontend",
              deadlineIso: "2026-04-19T15:00:00.000Z",
            },
          ],
        },
      ],
    };
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([])),
      findDueEscalationRules: vi.fn(() => Promise.resolve([twoGroupRule])),
    };
    const service = new RemindersService(
      makeEscalationServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));

    expect(queueAdds).toHaveLength(2);
    const byRecipient = new Map(
      queueAdds.map((q) => [q.data.recipientEmail, q.data]),
    );
    const digestA = byRecipient.get("head-a@test.local");
    const digestB = byRecipient.get("head-b@test.local");
    expect(
      (digestA?.lateLeads as { leadName: string }[]).map((l) => l.leadName),
    ).toEqual(["Alpha"]);
    expect(
      (digestB?.lateLeads as { leadName: string }[]).map((l) => l.leadName),
    ).toEqual(["Beta"]);
  });
});

describe("RemindersScheduler — opt-out", () => {
  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { enqueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      enqueue: vi.fn(
        (
          _executionId: string,
          data: Record<string, unknown>,
          context: Record<string, unknown>,
        ) => {
          queueAdds.push({ name: "send", data: { ...data, ...context } });
          return Promise.resolve();
        },
      ),
    };
  });

  it("lead with notificationOptOut=true SKIPS deadline reminder", async () => {
    const recipients = [
      {
        userId: "u1",
        email: "a@test.local",
        name: "Alpha",
        notificationOptOut: false,
      },
      {
        userId: "u2",
        email: "b@test.local",
        name: "Beta",
        notificationOptOut: true,
      },
    ];
    const due: DueDeadlineRule = {
      id: ruleId,
      reportId,
      fireAt: activeRule.fireAt,
      deadline: reportDeadline,
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      recipients,
    };
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([due])),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.recipientEmail).toBe("a@test.local");
  });

  it("escalation digest IGNORES head.notificationOptOut (heads always notified)", async () => {
    // The DueEscalationRule type does not even carry an opt-out flag for the
    // head — by design, escalation always bypasses opt-out. This test
    // verifies the dispatch path emits regardless.
    const due: DueEscalationRule = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      reportId,
      fireAt: new Date("2026-04-19T17:00:00.000Z"),
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      groups: [
        {
          head: {
            userId: "h1",
            email: "head@test.local",
            name: "Department Head",
          },
          lateLeads: [
            {
              leadName: "Alpha",
              sectionTitle: "Backend",
              deadlineIso: "2026-04-19T15:00:00.000Z",
            },
          ],
        },
      ],
    };
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() => Promise.resolve([])),
      findDueEscalationRules: vi.fn(() => Promise.resolve([due])),
    };
    const escalationActiveRule: AdminReminderRule = {
      id: due.id,
      reportId,
      kind: "escalation",
      fireAt: due.fireAt,
      timezone: "UTC",
      status: "active",
      version: 1,
      policyId: "99999999-9999-4999-8999-999999999999",
    };
    const escalationServiceRepo: RemindersRepository = {
      ...unusedRemindersRepositoryStubs(),
      getRule(rid) {
        return Promise.resolve(
          rid === due.id ? structuredClone(escalationActiveRule) : null,
        );
      },
      findExecutionByDedupeKey() {
        return Promise.resolve(null);
      },
      insertExecutionOnConflict(execution) {
        return Promise.resolve({
          execution: structuredClone(execution),
          outcome: "created" as const,
        });
      },
      getExecution() {
        return Promise.resolve(null);
      },
      listExecutions() {
        return Promise.resolve([]);
      },
    };
    const service = new RemindersService(
      escalationServiceRepo,
      undefined,
      fakeQueue as unknown as ConstructorParameters<typeof RemindersService>[2],
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));

    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.kind).toBe("escalation");
  });
});
