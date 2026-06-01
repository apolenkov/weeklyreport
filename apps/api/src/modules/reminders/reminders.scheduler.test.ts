import type {
  AdminReminderExecution,
  AdminReminderRule,
} from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationService } from "../organization/organization.service";
import type {
  DueDeadlineRule,
  DueEscalationRule,
} from "./reminders.prisma-repository";
import { RemindersScheduler } from "./reminders.scheduler";
import {
  type RemindersRepository,
  RemindersService,
} from "./reminders.service";

// UFB-047 / Phase 49-01: stub OrganizationService used by the scheduler
// to snapshot the brand identity onto every BullMQ job. Tests drive
// through the public `getPublic()` surface; the in-memory stub returns a
// deterministic shape so payload assertions can match `[PEO]` subjects.
const fakeOrganizationService = {
  getPublic: async () => ({
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  }),
} as unknown as OrganizationService;

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const ruleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reportId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const activeRule: AdminReminderRule = {
  id: ruleId,
  reportId,
  kind: "deadline",
  fireAt: new Date("2026-04-19T15:00:00.000Z"),
  timezone: "UTC",
  status: "active",
  version: 1,
  policyId: null,
};

function dueRuleFromRecipients(
  recipients: {
    userId: string;
    email: string;
    name: string;
    notificationOptOut?: boolean;
  }[],
): DueDeadlineRule {
  return {
    id: activeRule.id,
    reportId,
    fireAt: activeRule.fireAt,
    reportPeriodLabel: "2026-04-13 → 2026-04-19",
    recipients: recipients.map((r) => ({
      ...r,
      notificationOptOut: r.notificationOptOut ?? false,
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  In-memory RemindersRepository for the service                       */
/* ------------------------------------------------------------------ */

function createServiceRepo(): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    async getRule(rid) {
      return rid === activeRule.id ? structuredClone(activeRule) : null;
    },
    async findExecutionByDedupeKey(dedupeKey) {
      for (const exec of executions.values()) {
        if (exec.dedupeKey === dedupeKey) {
          return structuredClone(exec);
        }
      }
      return null;
    },
    async saveExecution(execution) {
      executions.set(execution.id, structuredClone(execution));
      return structuredClone(execution);
    },
    async getExecution(id) {
      return executions.get(id) ?? null;
    },
    async listExecutions(rid) {
      return [...executions.values()].filter((e) => e.ruleId === rid);
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("RemindersScheduler — NOTIF-01/03/04 (Phase 28-03)", () => {
  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      add: vi.fn(async (name: string, data: Record<string, unknown>) => {
        queueAdds.push({ name, data });
        return { id: "fake" };
      }),
    };
  });

  it("one lead with draft section at T-24h gets exactly one email per cycle (twice-fired tick is idempotent)", async () => {
    const recipients = [
      { userId: "u1", email: "lead@test.local", name: "Lead Alpha" },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => [
        dueRuleFromRecipients(recipients),
      ]),
      findDueEscalationRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    // Tick #1 at 16:00 UTC — same UTC day as the deadline (2026-04-19).
    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.kind).toBe("deadline");
    expect(queueAdds[0]?.data.recipientEmail).toBe("lead@test.local");

    // Tick #2 at 17:00 UTC — same UTC day. Idempotent — service deduplicates
    // on the same `${rule.id}:deadline:${cycleDate}:${email}` key.
    await scheduler.runOnce(new Date("2026-04-19T17:00:00.000Z"));
    expect(queueAdds).toHaveLength(1); // STILL one — second tick was a no-op
  });

  it("no lead with draft section → zero emails", async () => {
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => []),
      findDueEscalationRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
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
      findDueDeadlineRules: vi.fn(async () => [
        dueRuleFromRecipients(recipients),
      ]),
      findDueEscalationRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
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
      findDueDeadlineRules: vi.fn(async () => [
        dueRuleFromRecipients(recipients),
      ]),
      findDueEscalationRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    const data = queueAdds[0]?.data ?? {};
    expect(data.kind).toBe("deadline");
    expect(data.leadName).toBe("Lead Alpha");
    expect(data.reportPeriod).toBe("2026-04-13 → 2026-04-19");
    expect(data.deadlineIso).toBe("2026-04-19T15:00:00.000Z");
    expect(String(data.sectionUrl)).toContain(reportId);
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
      reportPeriodLabel: "2026-04-20 → 2026-04-26",
      recipients: recipients.map((r) => ({ ...r, notificationOptOut: false })),
    };

    let returnNplus1 = false;
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () =>
        returnNplus1 ? [ruleNplus1] : [ruleN],
      ),
      findDueEscalationRules: vi.fn(async () => []),
    };

    const serviceRepo = createServiceRepo();
    // Override the rule lookup so the second-cycle ruleId resolves.
    const originalGetRule = serviceRepo.getRule;
    serviceRepo.getRule = async (rid: string) => {
      if (rid === ruleNplus1.id) {
        return {
          ...activeRule,
          id: ruleNplus1.id,
          fireAt: ruleNplus1.fireAt,
        };
      }
      return originalGetRule(rid);
    };

    const service = new RemindersService(
      serviceRepo,
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(1);

    returnNplus1 = true;
    await scheduler.runOnce(new Date("2026-04-26T16:00:00.000Z"));
    expect(queueAdds).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------
// NOTIF-02 (Phase 29-05): T+2h escalation digest dispatch.
// One digest email per (rule, head) per cycle; idempotent across re-ticks.
// -----------------------------------------------------------------------

describe("RemindersScheduler — NOTIF-02 escalation dispatch (Phase 29-05)", () => {
  const escalationRuleId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const escalationActiveRule: AdminReminderRule = {
    id: escalationRuleId,
    reportId,
    kind: "escalation",
    fireAt: new Date("2026-04-19T17:00:00.000Z"), // T+2h after deadline
    timezone: "UTC",
    status: "active",
    version: 1,
    policyId: null,
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
      head: { userId: "h1", email: "head@test.local", name: "Department Head" },
      lateLeads: leads,
    };
  }

  function makeEscalationServiceRepo(): RemindersRepository {
    const executions = new Map<string, AdminReminderExecution>();
    return {
      async getRule(rid) {
        return rid === escalationRuleId
          ? structuredClone(escalationActiveRule)
          : null;
      },
      async findExecutionByDedupeKey(dedupeKey) {
        for (const exec of executions.values()) {
          if (exec.dedupeKey === dedupeKey) return structuredClone(exec);
        }
        return null;
      },
      async saveExecution(execution) {
        executions.set(execution.id, structuredClone(execution));
        return structuredClone(execution);
      },
      async getExecution(id) {
        return executions.get(id) ?? null;
      },
      async listExecutions(rid) {
        return [...executions.values()].filter((e) => e.ruleId === rid);
      },
    };
  }

  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      add: vi.fn(async (name: string, data: Record<string, unknown>) => {
        queueAdds.push({ name, data });
        return { id: "fake" };
      }),
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
      findDueDeadlineRules: vi.fn(async () => []),
      findDueEscalationRules: vi.fn(async () => [
        makeEscalationRule(lateLeads),
      ]),
    };

    const service = new RemindersService(
      makeEscalationServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
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
      findDueDeadlineRules: vi.fn(async () => []),
      findDueEscalationRules: vi.fn(async () => [
        makeEscalationRule(lateLeads),
      ]),
    };
    const service = new RemindersService(
      makeEscalationServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));

    const data = queueAdds[0]?.data ?? {};
    expect(data.headName).toBe("Department Head");
    expect(data.cycleDate).toBe("2026-04-19");
    expect(data.reportPeriod).toBe("2026-04-13 → 2026-04-19");
  });
});

// -----------------------------------------------------------------------
// NOTIF-05 (Phase 29-05): per-user opt-out for kind='deadline' only.
// kind='escalation' bypasses the flag entirely.
// -----------------------------------------------------------------------

describe("RemindersScheduler — NOTIF-05 opt-out (Phase 29-05)", () => {
  let queueAdds: { name: string; data: Record<string, unknown> }[];
  let fakeQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      add: vi.fn(async (name: string, data: Record<string, unknown>) => {
        queueAdds.push({ name, data });
        return { id: "fake" };
      }),
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
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      recipients,
    };
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => [due]),
      findDueEscalationRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    await scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z"));

    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.recipientEmail).toBe("a@test.local");
  });

  it("escalation digest IGNORES head.notificationOptOut (heads always notified)", async () => {
    // The DueEscalationRule type does not even carry an opt-out flag for the
    // head — by design, NOTIF-05 contract is "escalation bypasses opt-out".
    // This test verifies the dispatch path emits regardless.
    const due: DueEscalationRule = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      reportId,
      fireAt: new Date("2026-04-19T17:00:00.000Z"),
      reportPeriodLabel: "2026-04-13 → 2026-04-19",
      head: { userId: "h1", email: "head@test.local", name: "Department Head" },
      lateLeads: [
        {
          leadName: "Alpha",
          sectionTitle: "Backend",
          deadlineIso: "2026-04-19T15:00:00.000Z",
        },
      ],
    };
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => []),
      findDueEscalationRules: vi.fn(async () => [due]),
    };
    const escalationActiveRule: AdminReminderRule = {
      id: due.id,
      reportId,
      kind: "escalation",
      fireAt: due.fireAt,
      timezone: "UTC",
      status: "active",
      version: 1,
      policyId: null,
    };
    const escalationServiceRepo: RemindersRepository = {
      async getRule(rid) {
        return rid === due.id ? structuredClone(escalationActiveRule) : null;
      },
      async findExecutionByDedupeKey() {
        return null;
      },
      async saveExecution(execution) {
        return structuredClone(execution);
      },
      async getExecution() {
        return null;
      },
      async listExecutions() {
        return [];
      },
    };
    const service = new RemindersService(
      escalationServiceRepo,
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(
      service,
      fakeRepository as never,
      fakeOrganizationService,
    );

    await scheduler.runOnce(new Date("2026-04-19T17:30:00.000Z"));

    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data.kind).toBe("escalation");
  });
});
