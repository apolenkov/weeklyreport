import type {
  AdminReminderExecution,
  AdminReminderRule,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { ReminderExecutionIneligibleError } from "./reminders.errors.js";
import { ReminderDomainError, RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";

const activeRule: AdminReminderRule = {
  id: "66666666-6666-4666-8666-666666666666",
  reportId: "22222222-2222-4222-8222-222222222222",
  kind: "deadline",
  fireAt: new Date("2026-04-10T09:00:00.000Z"),
  timezone: "Europe/Moscow",
  status: "active",
  version: 1,
  policyId: "99999999-9999-4999-8999-999999999999",
};

const pausedRule: AdminReminderRule = {
  ...activeRule,
  id: "77777777-7777-4777-8777-777777777777",
  status: "paused",
};

const testPayload = {
  contractVersion: 1 as const,
  kind: "deadline" as const,
  cycleDate: "2026-04-10",
  leadName: "Test Lead",
  reportPeriod: "2026-04-07 → 2026-04-13",
  deadlineIso: "2026-04-10T09:00:00.000Z",
  sectionUrl:
    "http://localhost:3000/lead/report/22222222-2222-4222-8222-222222222222",
  organization: {
    shortName: "Demo",
    fullName: "Example Software Department",
  },
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
    getExecutionQueuePayload() {
      return Promise.resolve(structuredClone(testPayload));
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
    transitionExecutionToSending(executionId: string) {
      const execution = executions.get(executionId);
      if (execution?.status !== "queued") return Promise.resolve(null);
      executions.set(executionId, { ...execution, status: "sending" });
      return Promise.resolve({
        recipientEmail: execution.recipientEmail,
        queuePayload: structuredClone(testPayload),
      });
    },
    markExecutionSent(executionId: string, sentAt: Date) {
      const execution = executions.get(executionId);
      if (execution?.status !== "sending") return Promise.resolve(null);
      const sent = { ...execution, status: "sent" as const, sentAt };
      executions.set(executionId, sent);
      return Promise.resolve(structuredClone(sent));
    },
  };
}

describe("RemindersService", () => {
  it("creates a queued reminder execution for an active rule", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );

    expect(execution.status).toBe("queued");
    expect(execution.recipientEmail).toBe("lead1@weeklyreport.local");
  });

  it("returns the existing execution when the dedupe key matches", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const first = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );
    const second = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );

    expect(second.id).toBe(first.id);
  });

  it("rejects reminder execution for paused rules", async () => {
    const service = new RemindersService(
      createRepository(pausedRule),
      createNullLogger(),
    );

    await expect(
      service.requestReminderExecution(
        pausedRule.id,
        "lead1@weeklyreport.local",
        testPayload,
      ),
    ).rejects.toBeInstanceOf(ReminderDomainError);
  });

  it("marks queued reminders as sent", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const queued = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );
    expect(await service.claimExecutionForSending(queued.id)).toMatchObject({
      executionId: queued.id,
      recipientEmail: queued.recipientEmail,
      kind: "deadline",
    });
    const sent = await service.markReminderSent(queued.id);

    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeInstanceOf(Date);
  });
});

describe("reminder rule domain mapping and deduplication", () => {
  it("uses the deadline dispatch kind for a deadline rule", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );

    expect(execution.dedupeKey).toBe(
      `${activeRule.id}:deadline:2026-04-10:lead1@weeklyreport.local`,
    );
  });

  it("generates different dedupeKeys for different recipient emails", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const exec1 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );
    const exec2 = await service.requestReminderExecution(
      activeRule.id,
      "lead2@weeklyreport.local",
      testPayload,
    );

    expect(exec1.id).not.toBe(exec2.id);
    expect(exec1.dedupeKey).not.toBe(exec2.dedupeKey);
    expect(exec1.recipientEmail).toBe("lead1@weeklyreport.local");
    expect(exec2.recipientEmail).toBe("lead2@weeklyreport.local");
  });

  it("generates the same dedupeKey for the same email + rule + fireAt (deterministic)", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const exec1 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );
    const exec2 = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );

    // Same inputs must produce the same execution (idempotency via dedupeKey)
    expect(exec2.id).toBe(exec1.id);
    expect(exec2.dedupeKey).toBe(exec1.dedupeKey);
  });

  it("dedupeKey contains recipientEmail as a component", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const execution = await service.requestReminderExecution(
      activeRule.id,
      "lead1@weeklyreport.local",
      testPayload,
    );

    expect(execution.dedupeKey).toContain("lead1@weeklyreport.local");
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
      shortName: "Demo",
      fullName: "Example Software Department",
    },
  };

  it("builds dedupeKey of shape <ruleId>:deadline:<cycleDate>:<email> when payload is provided", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
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
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
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
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
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

  it("explicit payload uses its deadline cycle in the dedupe key", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      testPayload,
    );

    // activeRule.fireAt is 2026-04-10T09:00:00.000Z — UTC-truncated to
    // 2026-04-10, the same shape a payload-bearing scheduler tick builds.
    expect(manual.dedupeKey).toBe(
      `${activeRule.id}:deadline:2026-04-10:lead@test.local`,
    );
  });

  it("manual and automated payloads collide for the same cycle", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const automated = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...deadlinePayload, cycleDate: "2026-04-10" },
    );
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...testPayload, cycleDate: "2026-04-10" },
    );

    expect(manual.id).toBe(automated.id);
    expect(manual.dedupeKey).toBe(automated.dedupeKey);
  });

  it("payload dispatches for different cycles stay independent", async () => {
    const service = new RemindersService(
      createRepository(activeRule),
      createNullLogger(),
    );
    const manual = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      { ...testPayload, cycleDate: "2026-04-10" },
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

// Enqueue is gated on the atomic record outcome: a concurrent duplicate tick
// must enqueue nothing.
describe("requestReminderExecution — enqueue gated on record outcome", () => {
  function buildRepo(created: boolean): RemindersRepository {
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
          execution: created ? candidate : structuredClone(existing),
          outcome: created ? ("created" as const) : ("deduplicated" as const),
        });
      },
      getExecutionQueuePayload: () =>
        Promise.resolve(structuredClone(testPayload)),
      getExecution() {
        return Promise.resolve(null);
      },
      listExecutions() {
        return Promise.resolve([]);
      },
    } satisfies RemindersRepository;
    return repository;
  }

  it("enqueues exactly one job when this caller creates the row", async () => {
    const repository = buildRepo(true);
    const addCalls: unknown[] = [];
    const queue = {
      enqueue: (...args: unknown[]) => {
        addCalls.push(args);
        return Promise.resolve();
      },
    };
    const service = new RemindersService(repository, createNullLogger(), queue);

    await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      testPayload,
    );

    expect(addCalls).toHaveLength(1);
  });

  it("enqueues nothing when the row already existed", async () => {
    const repository = buildRepo(false);
    const addCalls: unknown[] = [];
    const queue = {
      enqueue: (...args: unknown[]) => {
        addCalls.push(args);
        return Promise.resolve();
      },
    };
    const service = new RemindersService(repository, createNullLogger(), queue);

    await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      testPayload,
    );

    expect(addCalls).toHaveLength(0);
  });

  it("returns skipped and enqueues nothing when the atomic lifecycle guard loses", async () => {
    const repository = {
      ...buildRepo(true),
      insertExecutionOnConflict: () =>
        Promise.reject(new ReminderExecutionIneligibleError()),
    } satisfies RemindersRepository;
    const queue = { enqueue: vi.fn() };
    const service = new RemindersService(repository, createNullLogger(), queue);

    await expect(
      service.requestReminderExecutionWithOutcome(
        activeRule.id,
        "lead@test.local",
        testPayload,
      ),
    ).resolves.toEqual({ execution: null, outcome: "skipped" });
    expect(queue.enqueue).not.toHaveBeenCalled();
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
          outcome: "created" as const,
        }),
    } satisfies RemindersRepository;
    const service = new RemindersService(repository, createNullLogger());

    await expect(
      service.requestReminderExecution(
        activeRule.id,
        "lead@test.local",
        testPayload,
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
  });
});

// A failed row IS the manual re-dispatch's dedupe hit under the unified key, so
// the service revives it (atomic failed→queued) and enqueues a fresh job. Any
// other state, or a lost revival CAS, keeps the plain dedup return.
describe("requestReminderExecution — failed execution revival", () => {
  async function manualRedispatch(
    service: RemindersService,
  ): Promise<AdminReminderExecution> {
    const result = await service.requestReminderExecutionWithOutcome(
      activeRule.id,
      "lead@test.local",
      testPayload,
      "manual",
    );
    if (!result.execution) throw new Error("manual redispatch was skipped");
    return result.execution;
  }

  function buildFailedRepo(opts: {
    status: AdminReminderExecution["status"];
    requeueWins?: boolean;
    requeueCalls?: string[];
    requeuePayloads?: ReminderQueuePayload[];
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
      insertExecutionOnConflict(
        _candidate: AdminReminderExecution,
        payload: ReminderQueuePayload,
        allowFailedRevival?: boolean,
      ) {
        if (allowFailedRevival && existing.status === "failed") {
          opts.requeueCalls?.push(existing.id);
          opts.requeuePayloads?.push(structuredClone(payload));
          if (opts.requeueWins ?? true) {
            return Promise.resolve({
              execution: {
                ...structuredClone(existing),
                status: "queued" as const,
                errorMessage: null,
              },
              outcome: "revived" as const,
            });
          }
        }
        return Promise.resolve({
          execution: structuredClone(existing),
          outcome: "deduplicated" as const,
        });
      },
      getExecutionQueuePayload: () =>
        Promise.resolve(structuredClone(testPayload)),
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

  it("never revives a terminal failure on the next automatic tick", async () => {
    const requeueCalls: string[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueCalls }),
      createNullLogger(),
      buildQueue(addCalls),
    );

    const result = await service.requestReminderExecutionWithOutcome(
      activeRule.id,
      "lead@test.local",
      testPayload,
    );

    expect(result.outcome).toBe("failed");
    expect(result.execution?.status).toBe("failed");
    expect(requeueCalls).toHaveLength(0);
    expect(addCalls).toHaveLength(0);
  });

  it("revives a failed row (failed→queued) and enqueues a fresh job", async () => {
    const requeueCalls: string[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueCalls }),
      createNullLogger(),
      buildQueue(addCalls),
    );

    const result = await manualRedispatch(service);

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

  it("refreshes a failed row with the next current dispatch", async () => {
    const requeuePayloads: ReminderQueuePayload[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({
        status: "failed",
        requeuePayloads,
      }),
      createNullLogger(),
      buildQueue(addCalls),
    );

    const result = await manualRedispatch(service);

    expect(result.status).toBe("queued");
    expect(requeuePayloads).toEqual([testPayload]);
    expect(addCalls).toHaveLength(1);
  });

  it("does not enqueue when another atomic caller wins revival", async () => {
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueWins: false }),
      createNullLogger(),
      buildQueue(addCalls),
    );

    const result = await manualRedispatch(service);

    expect(addCalls).toHaveLength(0);
    expect(result.status).toBe("failed");
  });

  it("never attempts revival for a row that is not failed", async () => {
    const requeueCalls: string[] = [];
    const addCalls: unknown[] = [];
    const service = new RemindersService(
      buildFailedRepo({ status: "sent", requeueCalls }),
      createNullLogger(),
      buildQueue(addCalls),
    );

    const result = await manualRedispatch(service);

    expect(requeueCalls).toHaveLength(0);
    expect(addCalls).toHaveLength(0);
    expect(result.status).toBe("sent");
  });

  it("fails loud when no queue is wired: a failed row is never flipped to queued-with-no-job", async () => {
    const requeueCalls: string[] = [];
    // No third argument → this.emailQueue is null, so there is no way to
    // enqueue a real job for a revived execution.
    const service = new RemindersService(
      buildFailedRepo({ status: "failed", requeueCalls }),
      createNullLogger(),
    );

    await expect(manualRedispatch(service)).rejects.toMatchObject({
      name: "ReminderDomainError",
      message:
        "Cannot revive a failed reminder execution: no email queue is wired.",
    });
    // The atomic revival must not run: no queue job could follow it.
    expect(requeueCalls).toHaveLength(0);
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
        return Promise.resolve({ execution: candidate, outcome: "created" });
      },
      markExecutionFailed(executionId: string, errorMessage: string) {
        failures.push([executionId, errorMessage]);
        return Promise.resolve();
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
    const service = new RemindersService(repository, createNullLogger(), queue);

    const result = await service.requestReminderExecution(
      activeRule.id,
      "lead@test.local",
      testPayload,
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Redis unavailable");
    expect(failures).toEqual([[result.id, "Redis unavailable"]]);
  });

  it.each([
    ["empty", new Error("")],
    ["whitespace-only", new Error(" \t ")],
  ] as const)(
    "stores a deterministic non-empty failure for a %s enqueue error",
    async (_label, enqueueError) => {
      const failures: [string, string][] = [];
      const repository = buildRepoCapturingFailures(failures);
      const queue = {
        enqueue: () => Promise.reject(enqueueError),
      };
      const service = new RemindersService(
        repository,
        createNullLogger(),
        queue,
      );

      const result = await service.requestReminderExecution(
        activeRule.id,
        "lead@test.local",
        testPayload,
      );

      expect(result).toMatchObject({
        status: "failed",
        errorMessage: "Unknown error",
      });
      expect(failures).toEqual([[result.id, "Unknown error"]]);
    },
  );
});

describe("stale sending reconciliation", () => {
  it("records every terminalized unknown delivery in telemetry", async () => {
    const recordUncertainDelivery = vi.fn();
    const repository = {
      ...unusedRemindersRepositoryStubs(),
      markStuckSendingUncertain: () => Promise.resolve(2),
    } satisfies RemindersRepository;
    const service = new RemindersService(
      repository,
      createNullLogger(),
      undefined,
      {
        captureJobContext: () => ({}),
        recordUncertainDelivery,
      },
    );

    await expect(
      service.reconcileStuckSendingExecutions(
        new Date("2026-04-11T11:30:00.000Z"),
      ),
    ).resolves.toBe(2);
    expect(recordUncertainDelivery).toHaveBeenCalledWith(2);
  });
});
