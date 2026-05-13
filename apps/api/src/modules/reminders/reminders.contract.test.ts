import { describe, expect, it, vi } from "vitest";

import {
  adminReminderExecutionSchema,
  type AdminReminderExecution,
  type AdminReminderRule,
} from "@customreport/shared";

import {
  ReminderDomainError,
  RemindersService,
  type RemindersRepository,
} from "./reminders.service";
import { expectDefined } from "../../test-utils/expect-defined.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const recipientEmail = "lead1@customreport.local";
const recipientEmail2 = "lead2@customreport.local";

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------

function createRepository(...rules: AdminReminderRule[]): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    async getRule(ruleId: string) {
      const found = rules.find((r) => r.id === ruleId);
      return found ? structuredClone(found) : null;
    },
    async findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return structuredClone(execution);
        }
      }
      return null;
    },
    async saveExecution(execution: AdminReminderExecution) {
      executions.set(execution.id, structuredClone(execution));
      return structuredClone(execution);
    },
    async getExecution(executionId: string) {
      const execution = executions.get(executionId);
      return execution ? structuredClone(execution) : null;
    },
    async listExecutions(ruleId: string) {
      return [...executions.values()]
        .filter((e) => e.ruleId === ruleId)
        .map((e) => structuredClone(e));
    },
  };
}

function createMockQueue() {
  return { add: vi.fn() };
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe("RemindersService — contract tests", () => {
  describe("requestReminderExecution", () => {
    // 1. creates execution for active rule
    it("creates an execution for an active rule", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution).toBeDefined();
      expect(execution.ruleId).toBe(activeRule.id);
      expect(execution.reportId).toBe(activeRule.reportId);
      expect(execution.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    // 2. throws when rule not found
    it("throws ReminderDomainError when rule is not found", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const unknownRuleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

      await expect(
        service.requestReminderExecution(unknownRuleId, recipientEmail),
      ).rejects.toBeInstanceOf(ReminderDomainError);

      await expect(
        service.requestReminderExecution(unknownRuleId, recipientEmail),
      ).rejects.toThrow(`Reminder rule ${unknownRuleId} was not found.`);
    });

    // 3. throws when rule is paused (status !== 'active')
    it("throws ReminderDomainError when rule is paused", async () => {
      const service = new RemindersService(createRepository(pausedRule));

      await expect(
        service.requestReminderExecution(pausedRule.id, recipientEmail),
      ).rejects.toBeInstanceOf(ReminderDomainError);

      await expect(
        service.requestReminderExecution(pausedRule.id, recipientEmail),
      ).rejects.toThrow("Reminder execution requires an active rule.");
    });

    // 4. deduplicates by ruleId:fireAt:email key
    it("deduplicates by ruleId:fireAt:email composite key", async () => {
      const service = new RemindersService(createRepository(activeRule));

      const first = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );
      const second = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(first.id).toBe(second.id);
      expect(first.dedupeKey).toBe(second.dedupeKey);
      expect(first.dedupeKey).toContain(activeRule.id);
      expect(first.dedupeKey).toContain(activeRule.fireAt.toISOString());
      expect(first.dedupeKey).toContain(recipientEmail);
    });

    // 5. returns existing execution on duplicate
    it("returns the existing execution on duplicate request", async () => {
      const service = new RemindersService(createRepository(activeRule));

      const original = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );
      const duplicate = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(duplicate.id).toBe(original.id);
      expect(duplicate.status).toBe(original.status);
      expect(duplicate.recipientEmail).toBe(original.recipientEmail);
    });

    // 6. enqueues BullMQ job when queue provided
    it("enqueues a BullMQ job when a queue is provided", async () => {
      const mockQueue = createMockQueue();
      const service = new RemindersService(
        createRepository(activeRule),
        undefined,
        mockQueue as unknown as import("bullmq").Queue,
      );

      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send",
        {
          executionId: execution.id,
          recipientEmail,
          reportPeriod: activeRule.reportId,
        },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
    });

    // 7. works without queue (null queue)
    it("works without a queue (null queue)", async () => {
      const service = new RemindersService(createRepository(activeRule));

      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution).toBeDefined();
      expect(execution.status).toBe("queued");
    });

    // 8. sets status to 'queued'
    it('sets status to "queued"', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution.status).toBe("queued");
    });

    // 9. sets recipientEmail correctly
    it("sets recipientEmail correctly", async () => {
      const service = new RemindersService(createRepository(activeRule));

      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail2,
      );

      expect(exec1.recipientEmail).toBe(recipientEmail);
      expect(exec2.recipientEmail).toBe(recipientEmail2);
      // Different recipients produce different executions
      expect(exec1.id).not.toBe(exec2.id);
    });
  });

  // P0/P1 Regression — execution edge cases (REM-001..012)
  describe("requestReminderExecution — regression", () => {
    it("execution has correct scheduledFor from rule.fireAt (REM-001)", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution.scheduledFor).toBeInstanceOf(Date);
      expect(execution.scheduledFor.toISOString()).toBe(
        activeRule.fireAt.toISOString(),
      );
    });

    it("execution has correct reportId from rule (REM-001)", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution.reportId).toBe(activeRule.reportId);
    });

    it("execution starts with sentAt=null and errorMessage=null", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      expect(execution.sentAt).toBeNull();
      expect(execution.errorMessage).toBeNull();
    });

    it("different recipients create different executions (REM-002 dedup by email)", async () => {
      const service = new RemindersService(createRepository(activeRule));

      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        "a@test.com",
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        "b@test.com",
      );

      expect(exec1.id).not.toBe(exec2.id);
      expect(exec1.dedupeKey).not.toBe(exec2.dedupeKey);
    });
  });

  describe("markReminderSent", () => {
    // 10. sets status to 'sent' and sentAt
    it('sets status to "sent" and populates sentAt', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const queued = await service.requestReminderExecution(
        activeRule.id,
        recipientEmail,
      );

      const before = new Date();
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

    // 11. throws when execution not found
    it("throws ReminderDomainError when execution is not found", async () => {
      const service = new RemindersService(createRepository(activeRule));
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
    // 12. returns all executions for rule
    it("returns all executions for a rule", async () => {
      const service = new RemindersService(createRepository(activeRule));

      await service.requestReminderExecution(activeRule.id, recipientEmail);
      await service.requestReminderExecution(activeRule.id, recipientEmail2);

      const result = await service.listExecutions(activeRule.id);

      expect(result.items).toHaveLength(2);
      const emails = result.items.map((e) => e.recipientEmail).sort();
      expect(emails).toEqual([recipientEmail, recipientEmail2].sort());
    });

    // 13. returns empty array when no executions
    it("returns an empty array when no executions exist", async () => {
      const service = new RemindersService(createRepository(activeRule));
      const result = await service.listExecutions(activeRule.id);

      expect(result.items).toEqual([]);
    });

    // 14. validates output through Zod schema
    it("validates output through Zod schema", async () => {
      const service = new RemindersService(createRepository(activeRule));
      await service.requestReminderExecution(activeRule.id, recipientEmail);

      const result = await service.listExecutions(activeRule.id);

      // listExecutions internally calls adminReminderExecutionSchema.array().parse(),
      // so no ZodError means validation passed. Verify the shape is correct.
      expect(result.items).toHaveLength(1);
      const execution = expectDefined(result.items[0]);

      // Verify Zod coercion produced correct types
      expect(execution.scheduledFor).toBeInstanceOf(Date);
      expect(typeof execution.id).toBe("string");
      expect(typeof execution.dedupeKey).toBe("string");
      expect(execution.sentAt).toBeNull();
      expect(execution.errorMessage).toBeNull();

      // Also validate independently with the schema (no throw = pass)
      const parsed = adminReminderExecutionSchema.parse(execution);
      expect(parsed.id).toBe(execution.id);
    });
  });
});
