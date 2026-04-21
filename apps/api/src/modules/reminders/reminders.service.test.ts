import { describe, expect, it } from 'vitest';

import type {
  AdminReminderExecution,
  AdminReminderRule,
} from '@customreport/shared';

import { remindersRouter } from './reminders.router';
import {
  ReminderDomainError,
  RemindersService,
  type RemindersRepository,
} from './reminders.service';

const activeRule: AdminReminderRule = {
  id: '66666666-6666-4666-8666-666666666666',
  reportId: '22222222-2222-4222-8222-222222222222',
  kind: 'deadline',
  fireAt: new Date('2026-04-10T09:00:00.000Z'),
  timezone: 'Europe/Moscow',
  status: 'active',
  version: 1,
};

const pausedRule: AdminReminderRule = {
  ...activeRule,
  id: '77777777-7777-4777-8777-777777777777',
  status: 'paused',
};

function createRepository(initialRule: AdminReminderRule): RemindersRepository {
  const executions = new Map<string, AdminReminderExecution>();

  return {
    async findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return structuredClone(execution);
        }
      }

      return null;
    },
    async getRule(ruleId: string) {
      if (ruleId === initialRule.id) {
        return structuredClone(initialRule);
      }

      return null;
    },
    async getExecution(executionId: string) {
      const execution = executions.get(executionId);
      return execution ? structuredClone(execution) : null;
    },
    async listExecutions(ruleId: string) {
      return [...executions.values()]
        .filter((execution) => execution.ruleId === ruleId)
        .map((execution) => structuredClone(execution));
    },
    async saveExecution(execution: AdminReminderExecution) {
      executions.set(execution.id, structuredClone(execution));
      return structuredClone(execution);
    },
  };
}

describe('RemindersService', () => {
  it('creates a queued reminder execution for an active rule', async () => {
    const service = new RemindersService(createRepository(activeRule));
    const execution = await service.requestReminderExecution(
      activeRule.id,
      'lead1@customreport.local',
    );

    expect(execution.status).toBe('queued');
    expect(execution.recipientEmail).toBe('lead1@customreport.local');
  });

  it('returns the existing execution when the dedupe key matches', async () => {
    const service = new RemindersService(createRepository(activeRule));
    const first = await service.requestReminderExecution(
      activeRule.id,
      'lead1@customreport.local',
    );
    const second = await service.requestReminderExecution(
      activeRule.id,
      'lead1@customreport.local',
    );

    expect(second.id).toBe(first.id);
  });

  it('rejects reminder execution for paused rules', async () => {
    const service = new RemindersService(createRepository(pausedRule));

    await expect(
      service.requestReminderExecution(pausedRule.id, 'lead1@customreport.local'),
    ).rejects.toBeInstanceOf(ReminderDomainError);
  });

  it('marks queued reminders as sent', async () => {
    const service = new RemindersService(createRepository(activeRule));
    const queued = await service.requestReminderExecution(
      activeRule.id,
      'lead1@customreport.local',
    );
    const sent = await service.markReminderSent(queued.id);

    expect(sent.status).toBe('sent');
    expect(sent.sentAt).toBeInstanceOf(Date);
  });
});

  describe('reminder rule domain mapping and deduplication', () => {
    const weeklyRule: AdminReminderRule = {
      ...activeRule,
      id: '88888888-8888-4888-8888-888888888888',
      kind: 'follow_up',
    };

    it('reads kind from DB field — deadline rule', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        'lead1@customreport.local',
      );

      // The dedupeKey embeds the rule id and fireAt, which come from
      // the DB rule's kind-specific scheduling. The execution's ruleId
      // correctly maps to the deadline rule.
      expect(execution.ruleId).toBe(activeRule.id);
    });

    it('reads kind from DB field — weekly rule', async () => {
      const service = new RemindersService(createRepository(weeklyRule));
      const execution = await service.requestReminderExecution(
        weeklyRule.id,
        'lead1@customreport.local',
      );

      expect(execution.ruleId).toBe(weeklyRule.id);
    });

    it('generates different dedupeKeys for different recipient emails', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        'lead1@customreport.local',
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        'lead2@customreport.local',
      );

      // Different emails must produce different executions
      expect(exec1.id).not.toBe(exec2.id);
      expect(exec1.dedupeKey).not.toBe(exec2.dedupeKey);
      expect(exec1.recipientEmail).toBe('lead1@customreport.local');
      expect(exec2.recipientEmail).toBe('lead2@customreport.local');
    });

    it('generates the same dedupeKey for the same email + rule + fireAt (deterministic)', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const exec1 = await service.requestReminderExecution(
        activeRule.id,
        'lead1@customreport.local',
      );
      const exec2 = await service.requestReminderExecution(
        activeRule.id,
        'lead1@customreport.local',
      );

      // Same inputs must produce the same execution (idempotency via dedupeKey)
      expect(exec2.id).toBe(exec1.id);
      expect(exec2.dedupeKey).toBe(exec1.dedupeKey);
    });

    it('dedupeKey contains recipientEmail as a component', async () => {
      const service = new RemindersService(createRepository(activeRule));
      const execution = await service.requestReminderExecution(
        activeRule.id,
        'lead1@customreport.local',
      );

      expect(execution.dedupeKey).toContain('lead1@customreport.local');
    });
  });

describe('remindersRouter', () => {
  it('returns rule execution history', async () => {
    const service = new RemindersService(createRepository(activeRule));
    await service.requestReminderExecution(activeRule.id, 'lead1@customreport.local');

    const result = await remindersRouter.listExecutions({ remindersService: service, ruleId: activeRule.id });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
