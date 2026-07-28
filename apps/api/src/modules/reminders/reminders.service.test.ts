import type {
  AdminReminderExecution,
  AdminReminderRule,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { ReminderDomainError, RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import { unusedRemindersRepositoryStubs } from "./reminders-scope.repository-stub.js";

const activeRule: AdminReminderRule = {
  id: "66666666-6666-4666-8666-666666666666",
  reportId: "22222222-2222-4222-8222-222222222222",
  kind: "deadline",
  fireAt: new Date("2026-04-10T09:00:00.000Z"),
  timezone: "Europe/Moscow",
  status: "active",
  version: 1,
  policyId: null,
};

const pausedRule: AdminReminderRule = {
  ...activeRule,
  id: "77777777-7777-4777-8777-777777777777",
  status: "paused",
};

function createRepository(initialRule: AdminReminderRule): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    ...unusedRemindersRepositoryStubs(),
    findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return Promise.resolve(structuredClone(execution));
        }
      }

      return Promise.resolve(null);
    },
    getRule(ruleId: string) {
      if (ruleId === initialRule.id) {
        return Promise.resolve(structuredClone(initialRule));
      }

      return Promise.resolve(null);
    },
    insertExecutionOnConflict(execution: AdminReminderExecution) {
      for (const existing of executions.values()) {
        if (existing.dedupeKey === execution.dedupeKey) {
          return Promise.resolve({
            execution: structuredClone(existing),
            inserted: false,
          });
        }
      }
      executions.set(execution.id, structuredClone(execution));
      return Promise.resolve({
        execution: structuredClone(execution),
        inserted: true,
      });
    },
    getExecution(executionId: string) {
      const execution = executions.get(executionId);
      return Promise.resolve(execution ? structuredClone(execution) : null);
    },
    listExecutions(ruleId: string) {
      return Promise.resolve(
        [...executions.values()]
          .filter((execution) => execution.ruleId === ruleId)
          .map((execution) => structuredClone(execution)),
      );
    },
    saveExecution(execution: AdminReminderExecution) {
      executions.set(execution.id, structuredClone(execution));
      return Promise.resolve(structuredClone(execution));
    },
  };
}

describe("RemindersService", () => {
  it("creates a queued reminder execution for an active rule", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );

    expect(execution.status).toBe("queued");
    expect(execution.recipientEmail).toBe("lead1@customreport.local");
  });

  it("returns the existing execution when the dedupe key matches", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const first = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );
    const second = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );

    expect(second.id).toBe(first.id);
  });

  it("rejects reminder execution for paused rules", async () => {
    const service = new RemindersService(createRepository(pausedRule));

    await expect(
      service.requestReminderExecution(
        pausedRule.id,
        "lead1@customreport.local",
      ),
    ).rejects.toBeInstanceOf(ReminderDomainError);
  });

  it("marks queued reminders as sent", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const queued = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );
    const sent = await service.markReminderSent(queued.id);

    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeInstanceOf(Date);
  });
});

describe("reminder rule domain mapping and deduplication", () => {
  const weeklyRule: AdminReminderRule = {
    ...activeRule,
    id: "88888888-8888-4888-8888-888888888888",
    kind: "follow_up",
  };

  it("uses the deadline dispatch kind for a deadline rule", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );

    expect(execution.dedupeKey).toBe(
      `${activeRule.id}:deadline:2026-04-10:lead1@customreport.local`,
    );
  });

  it("uses the manual deadline dispatch kind for a follow-up rule", async () => {
    const service = new RemindersService(createRepository(weeklyRule));
    const execution = await service.requestReminderExecution(
      weeklyRule.id,
      "lead1@customreport.local",
    );

    expect(execution.dedupeKey).toBe(
      `${weeklyRule.id}:deadline:2026-04-10:lead1@customreport.local`,
    );
  });

  it("generates different dedupeKeys for different recipient emails", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const exec1 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );
    const exec2 = await service.requestReminderExecution(
      activeRule.id,
      "lead2@customreport.local",
    );

    expect(exec1.id).not.toBe(exec2.id);
    expect(exec1.dedupeKey).not.toBe(exec2.dedupeKey);
    expect(exec1.recipientEmail).toBe("lead1@customreport.local");
    expect(exec2.recipientEmail).toBe("lead2@customreport.local");
  });

  it("generates the same dedupeKey for the same email + rule + fireAt (deterministic)", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const exec1 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );
    const exec2 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );

    // Same inputs must produce the same execution (idempotency via dedupeKey)
    expect(exec2.id).toBe(exec1.id);
    expect(exec2.dedupeKey).toBe(exec1.dedupeKey);
  });

  it("dedupeKey contains recipientEmail as a component", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@customreport.local",
    );

    expect(execution.dedupeKey).toContain("lead1@customreport.local");
  });
});

describe("deadline payload — extended dedupe-key shape", () => {
  const deadlinePayload = {
    kind: "deadline" as const,
    cycleDate: "2026-04-19",
    leadName: "Lead Alpha",
    reportPeriod: "2026-04-13 → 2026-04-19",
    deadlineIso: "2026-04-19T15:00:00.000Z",
    sectionUrl: "http://localhost:3000/lead/report?reportId=abc",
    // Brand snapshot threaded through the payload.
    organization: {
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    },
  };

  it("builds dedupeKey of shape <ruleId>:deadline:<cycleDate>:<email> when payload is provided", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const exec = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      deadlinePayload,
    );

    expect(exec.dedupeKey).toBe(
      `${activeRule.id}:deadline:2026-04-19:lead@test.local`,
    );
  });

  it("two calls with same (ruleId, kind, cycleDate, email) collapse to one execution", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const first = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      deadlinePayload,
    );
    const second = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      deadlinePayload,
    );

    expect(second.id).toBe(first.id);
    expect(second.dedupeKey).toBe(first.dedupeKey);
  });

  it("different cycleDate ⇒ different dedupeKey ⇒ different execution", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const cycleN = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...deadlinePayload, cycleDate: "2026-04-19" },
    );
    const cycleNplus1 = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...deadlinePayload, cycleDate: "2026-04-26" },
    );

    expect(cycleNplus1.id).not.toBe(cycleN.id);
    expect(cycleNplus1.dedupeKey).not.toBe(cycleN.dedupeKey);
  });

  it("no-payload dispatch defaults to kind:'deadline' with cycleDate from the rule's own fireAt", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    // activeRule.fireAt is 2026-04-10T09:00:00.000Z — UTC-truncated to
    // 2026-04-10, the same shape a payload-bearing scheduler tick builds.
    expect(manual.dedupeKey).toBe(
      `${activeRule.id}:deadline:2026-04-10:lead@test.local`,
    );
  });

  it("a no-payload manual dispatch collides with an automated payload for the same cycle — no second execution (regression)", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const automated = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...deadlinePayload, cycleDate: "2026-04-10" },
    );
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    expect(manual.id).toBe(automated.id);
    expect(manual.dedupeKey).toBe(automated.dedupeKey);
  });

  it("no-payload and payload dispatches for a DIFFERENT cycle stay independent", async () => {
    const service = new RemindersService(createRepository(activeRule));
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );
    const automated = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      deadlinePayload,
    );

    expect(automated.id).not.toBe(manual.id);
    expect(automated.dedupeKey).not.toBe(manual.dedupeKey);
  });
});

// Enqueue is gated on the atomic insert's `inserted` flag: a caller that did
// NOT create the row (a concurrent duplicate tick) must enqueue nothing.
describe("requestReminderExecution — enqueue gated on insert", () => {
  function buildRepo(inserted: boolean): RemindersRepository {
    const existing: AdminReminderExecution = {
      id: "99999999-9999-4999-8999-999999999999",
      ruleId: activeRule.id,
      reportId: activeRule.reportId,
      dedupeKey: `${activeRule.id}:${activeRule.fireAt.toISOString()}:lead@test.local`,
      status: "queued",
      scheduledFor: activeRule.fireAt,
      sentAt: null,
      recipientEmail: "lead@test.local",
      errorMessage: null,
    };
    const repository = {
      ...unusedRemindersRepositoryStubs(),
      getRule(ruleId: string) {
        return Promise.resolve(
          ruleId === activeRule.id ? structuredClone(activeRule) : null,
        );
      },
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      findExecutionByDedupeKey() {
        return Promise.resolve(null);
      },
      insertExecutionOnConflict(candidate: AdminReminderExecution) {
        return Promise.resolve({
          execution: inserted ? candidate : structuredClone(existing),
          inserted,
        });
      },
      saveExecution(execution: AdminReminderExecution) {
        return Promise.resolve(structuredClone(execution));
      },
      getExecution() {
        return Promise.resolve(null);
      },
      listExecutions() {
        return Promise.resolve([]);
      },
    } satisfies RemindersRepository;
    return repository;
  }

  it("enqueues exactly one job when this caller inserted the row", async () => {
    const repository = buildRepo(true);
    const addCalls: unknown[] = [];
    const queue = {
      enqueue: (...args: unknown[]) => {
        addCalls.push(args);
        return Promise.resolve();
      },
    };
    const service = new RemindersService(repository, undefined, queue);

    await service.requestReminderExecution(activeRule.id, "lead@test.local");

    expect(addCalls).toHaveLength(1);
  });

  it("enqueues nothing when the row already existed (inserted=false)", async () => {
    const repository = buildRepo(false);
    const addCalls: unknown[] = [];
    const queue = {
      enqueue: (...args: unknown[]) => {
        addCalls.push(args);
        return Promise.resolve();
      },
    };
    const service = new RemindersService(repository, undefined, queue);

    await service.requestReminderExecution(activeRule.id, "lead@test.local");

    expect(addCalls).toHaveLength(0);
  });

  it("parses a newly inserted execution before returning without a queue", async () => {
    const repository = {
      ...buildRepo(true),
      insertExecutionOnConflict: (candidate: AdminReminderExecution) =>
        Promise.resolve({
          execution: {
            ...candidate,
            status: "invalid-repository-status",
          } as unknown as AdminReminderExecution,
          inserted: true,
        }),
    } satisfies RemindersRepository;
    const service = new RemindersService(repository);

    await expect(
      service.requestReminderExecution(activeRule.id, "lead@test.local"),
    ).rejects.toMatchObject({ name: "ZodError" });
  });
});

// A failed row IS the manual re-dispatch's dedupe hit under the unified key, so
// the service revives it (atomic failed→queued) and enqueues a fresh job. Any
// other state, or a lost revival CAS, keeps the plain dedup return.
describe("requestReminderExecution — failed execution revival", () => {
  function buildFailedRepo(opts: {
    status: AdminReminderExecution["status"];
    requeueWins?: boolean;
    requeueCalls?: string[];
  }): RemindersRepository {
    const existing: AdminReminderExecution = {
      id: "99999999-9999-4999-8999-999999999998",
      ruleId: activeRule.id,
      reportId: activeRule.reportId,
      dedupeKey: `${activeRule.id}:deadline:2026-04-10:lead@test.local`,
      status: opts.status,
      scheduledFor: activeRule.fireAt,
      sentAt: null,
      recipientEmail: "lead@test.local",
      errorMessage: opts.status === "failed" ? "SMTP down" : null,
    };
    return {
      ...unusedRemindersRepositoryStubs(),
      getRule(ruleId: string) {
        return Promise.resolve(
          ruleId === activeRule.id ? structuredClone(activeRule) : null,
        );
      },
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      findExecutionByDedupeKey() {
        return Promise.resolve(structuredClone(existing));
      },
      insertExecutionOnConflict() {
        return Promise.resolve({
          execution: structuredClone(existing),
          inserted: false,
        });
      },
      requeueFailedExecution(executionId: string) {
        opts.requeueCalls?.push(executionId);
        return Promise.resolve(opts.requeueWins ?? true);
      },
      saveExecution(execution: AdminReminderExecution) {
        return Promise.resolve(structuredClone(execution));
      },
      getExecution() {
        return Promise.resolve(null);
      },
      listExecutions() {
        return Promise.resolve([]);
      },
    } satisfies RemindersRepository;
  }

  function buildQueue(addCalls: unknown[]) {
    return {
      enqueue: (...args: unknown[]) => {
        addCalls.push(args);
        return Promise.resolve();
      },
    };
  }

  it("revives a failed row (failed→queued) and enqueues a fresh job", async () => {
    const requeueCalls: string[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueCalls }),
      undefined,
      buildQueue(addCalls),
    );

    const result = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    expect(requeueCalls).toHaveLength(1);
    expect(addCalls).toHaveLength(1);
    expect(result.status).toBe("queued");
    expect(result.errorMessage).toBeNull();
    // The revival must NOT reuse the row id as the queue jobId: the original
    // failed job is retained (removeOnFail count) and the backend silently
    // dedups an add against any still-existing jobId.
    const [jobId] = addCalls[0] as [string, ...unknown[]];
    expect(jobId).not.toBe("99999999-9999-4999-8999-999999999998");
    expect(jobId).toContain("99999999-9999-4999-8999-999999999998");
  });

  it("does not enqueue when the revival CAS is lost to a concurrent caller", async () => {
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueWins: false }),
      undefined,
      buildQueue(addCalls),
    );

    const result = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    expect(addCalls).toHaveLength(0);
    expect(result.status).toBe("failed");
  });

  it("never attempts revival for a row that is not failed", async () => {
    const requeueCalls: string[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "sent", requeueCalls }),
      undefined,
      buildQueue(addCalls),
    );

    const result = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    expect(requeueCalls).toHaveLength(0);
    expect(addCalls).toHaveLength(0);
    expect(result.status).toBe("sent");
  });
});

// A synchronous enqueue throw must NOT leave a committed `queued` row with no
// job: the execution is marked `failed`, and the throw does not propagate past
// the recipient boundary so the scheduler tick continues.
describe("requestReminderExecution — enqueue failure is recorded, not swallowed", () => {
  function buildRepoCapturingFailures(failures: [string, string][]) {
    return {
      ...unusedRemindersRepositoryStubs(),
      getRule(ruleId: string) {
        return Promise.resolve(
          ruleId === activeRule.id ? structuredClone(activeRule) : null,
        );
      },
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      findExecutionByDedupeKey() {
        return Promise.resolve(null);
      },
      insertExecutionOnConflict(candidate: AdminReminderExecution) {
        return Promise.resolve({ execution: candidate, inserted: true });
      },
      markExecutionFailed(executionId: string, errorMessage: string) {
        failures.push([executionId, errorMessage]);
        return Promise.resolve();
      },
      saveExecution(execution: AdminReminderExecution) {
        return Promise.resolve(structuredClone(execution));
      },
      getExecution() {
        return Promise.resolve(null);
      },
      listExecutions() {
        return Promise.resolve([]);
      },
    } satisfies RemindersRepository;
  }

  it("marks the execution failed (not queued) and does not rethrow", async () => {
    const failures: [string, string][] = [];
    const repository = buildRepoCapturingFailures(failures);
    const queue = {
      enqueue: () => {
        return Promise.reject(new Error("Redis unavailable"));
      },
    };
    const service = new RemindersService(repository, undefined, queue);

    const result = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Redis unavailable");
    expect(failures).toEqual([[result.id, "Redis unavailable"]]);
  });
});
