import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { ReminderDomainError, RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import { createNullLogger } from "../../lib/logger";

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

const recipientEmail = "lead1@customreport.local";
const recipientEmail2 = "lead2@customreport.local";
const REPORT_PERIOD_LABEL = "2026-04-07 → 2026-04-13";
const testPayload = {
  contractVersion: 1 as const,
  kind: "deadline" as const,
  cycleDate: "2026-04-10",
  leadName: "Test Lead",
  reportPeriod: REPORT_PERIOD_LABEL,
  deadlineIso: "2026-04-10T09:00:00.000Z",
  sectionUrl:
    "http://localhost:3000/lead/report/22222222-2222-4222-8222-222222222222",
  organization: {
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  },
};

function createRepository(...rules: AdminReminderRule[]): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    ...unusedRemindersRepositoryStubs(),
    getRule(ruleId: string) {
      const found = rules.find((r) => r.id === ruleId);
      return Promise.resolve(found ? structuredClone(found) : null);
    },
    getRulePeriodLabel: () => Promise.resolve(REPORT_PERIOD_LABEL),
    findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return Promise.resolve(structuredClone(execution));
        }
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
    getExecutionQueuePayload: () =>
      Promise.resolve(structuredClone(testPayload)),
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
    getExecution(executionId: string) {
      const execution = executions.get(executionId);
      return Promise.resolve(execution ? structuredClone(execution) : null);
    },
    listExecutions(ruleId: string) {
      return Promise.resolve(
        [...executions.values()]
          .filter((e) => e.ruleId === ruleId)
          .map((e) => structuredClone(e)),
      );
    },
  };
}

function createMockQueue() {
  return { enqueue: vi.fn() };
}

describe("RemindersService — contract tests", () => {
  describe("requestReminderExecution", () => {
    it("creates an execution for an active rule", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution).toBeDefined();
      expect(execution.ruleId).toBe(activeRule.id);
      expect(execution.reportId).toBe(activeRule.reportId);
      expect(execution.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("throws ReminderDomainError when rule is not found", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const unknownRuleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      await expect(
        service.requestReminderExecution(
          unknownRuleId,
          recipientEmail,
          testPayload,
        ),
      ).rejects.toBeInstanceOf(ReminderDomainError);

      await expect(
        service.requestReminderExecution(
          unknownRuleId,
          recipientEmail,
          testPayload,
        ),
      ).rejects.toThrow(`Reminder rule ${unknownRuleId} was not found.`);
    });

    it("throws ReminderDomainError when rule is paused", async () => {
      const service = new RemindersService(
        createRepository(pausedRule),
        createNullLogger(),
      );

      await expect(
        service.requestReminderExecution(
          pausedRule.id,
          recipientEmail,
          testPayload,
        ),
      ).rejects.toBeInstanceOf(ReminderDomainError);

      await expect(
        service.requestReminderExecution(
          pausedRule.id,
          recipientEmail,
          testPayload,
        ),
      ).rejects.toThrow("Reminder execution requires an active rule.");
    });

    it("deduplicates by ruleId:kind:cycleDate:email composite key", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      const first = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );
      const second = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(first.id).toBe(second.id);
      expect(first.dedupeKey).toBe(second.dedupeKey);
      expect(first.dedupeKey).toContain(activeRule.id);
      // No-payload dispatch defaults to kind: 'deadline' with cycleDate
      // truncated from the rule's own fireAt (see resolveReminderDedupeKey).
      expect(first.dedupeKey).toContain("deadline");
      expect(first.dedupeKey).toContain(
        activeRule.fireAt.toISOString().slice(0, 10),
      );
      expect(first.dedupeKey).toContain(recipientEmail);
    });

    it("returns the existing execution on duplicate request", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      const original = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );
      const duplicate = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(duplicate.id).toBe(original.id);
      expect(duplicate.status).toBe(original.status);
      expect(duplicate.recipientEmail).toBe(original.recipientEmail);
    });

    it("enqueues a BullMQ job when a queue is provided", async () => {
      const mockQueue = createMockQueue();
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
        mockQueue,
      );

      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        execution.id,
        expect.objectContaining({
          executionId: execution.id,
          recipientEmail,
          kind: "deadline",
          reportPeriod: REPORT_PERIOD_LABEL,
        }),
        {},
        undefined,
      );
    });

    it("works without a queue (null queue)", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution).toBeDefined();
      expect(execution.status).toBe("queued");
    });

    it('sets status to "queued"', async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution.status).toBe("queued");
    });

    it("sets recipientEmail correctly", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail2,
        testPayload,
      );

      expect(exec1.recipientEmail).toBe(recipientEmail);
      expect(exec2.recipientEmail).toBe(recipientEmail2);
      expect(exec1.id).not.toBe(exec2.id);
    });
  });

  describe("requestReminderExecution — regression", () => {
    it("execution has correct scheduledFor from rule.fireAt", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution.scheduledFor).toBeInstanceOf(Date);
      expect(execution.scheduledFor.toISOString()).toBe(
        activeRule.fireAt.toISOString(),
      );
    });

    it("execution has correct reportId from rule", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution.reportId).toBe(activeRule.reportId);
    });

    it("execution starts with sentAt=null and errorMessage=null", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      expect(execution.sentAt).toBeNull();
      expect(execution.errorMessage).toBeNull();
    });

    it("different recipients create different executions (dedup by email)", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        "a@test.com",
        testPayload,
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        "b@test.com",
        testPayload,
      );

      expect(exec1.id).not.toBe(exec2.id);
      expect(exec1.dedupeKey).not.toBe(exec2.dedupeKey);
    });
  });

  describe("markReminderSent", () => {
    it('sets status to "sent" and populates sentAt', async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const queued = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      const before = new Date();
      expect(await service.claimExecutionForSending(queued.id)).toMatchObject({
        executionId: queued.id,
        recipientEmail: queued.recipientEmail,
        kind: "deadline",
      });
      const sent = await service.markReminderSent(queued.id);
      const after = new Date();

      expect(sent.status).toBe("sent");
      expect(sent.sentAt).toBeInstanceOf(Date);
      expect(expectDefined(sent.sentAt).getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(expectDefined(sent.sentAt).getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    it("throws ReminderDomainError when execution is not found", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const missingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

      await expect(service.markReminderSent(missingId)).rejects.toBeInstanceOf(
        ReminderDomainError,
      );

      await expect(service.markReminderSent(missingId)).rejects.toThrow(
        `Reminder execution ${missingId} was not found.`,
      );
    });
  });

  describe("listExecutions", () => {
    it("returns all executions for a rule", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );

      await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );
      await service.requestReminderExecution(
        activeRule.id,
        recipientEmail2,
        testPayload,
      );

      const result = await service.listExecutions(activeRule.id);

      expect(result.items).toHaveLength(2);
      const emails = result.items.map((e) => e.recipientEmail).sort();
      expect(emails).toEqual([recipientEmail, recipientEmail2].sort());
    });

    it("returns an empty array when no executions exist", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      const result = await service.listExecutions(activeRule.id);

      expect(result.items).toEqual([]);
    });

    it("validates output through Zod schema", async () => {
      const service = new RemindersService(
        createRepository(activeRule),
        createNullLogger(),
      );
      await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
        testPayload,
      );

      const result = await service.listExecutions(activeRule.id);

      // listExecutions internally calls adminReminderExecutionSchema.array().parse(),
      // so no ZodError means validation passed. Verify the shape is correct.
      expect(result.items).toHaveLength(1);
      const execution = expectDefined(result.items[0]);

      expect(execution.scheduledFor).toBeInstanceOf(Date);
      expect(typeof execution.id).toBe("string");
      expect(typeof execution.dedupeKey).toBe("string");
      expect(execution.sentAt).toBeNull();
      expect(execution.errorMessage).toBeNull();
      const parsed = adminReminderExecutionSchema.parse(execution);
      expect(parsed.id).toBe(execution.id);
    });
  });
});
