import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AdminReminderExecution, AdminReminderRule } from '@customreport/shared';

import { RemindersScheduler } from './reminders.scheduler';
import {
  RemindersService,
  type RemindersRepository,
} from './reminders.service';
import type { DueDeadlineRule } from './reminders.prisma-repository';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const ruleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reportId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const activeRule: AdminReminderRule = {
  id: ruleId,
  reportId,
  kind: 'deadline',
  fireAt: new Date('2026-04-19T15:00:00.000Z'),
  timezone: 'UTC',
  status: 'active',
  version: 1,
};

function dueRuleFromRecipients(
  recipients: Array<{ userId: string; email: string; name: string }>,
): DueDeadlineRule {
  return {
    id: activeRule.id,
    reportId,
    fireAt: activeRule.fireAt,
    reportPeriodLabel: '2026-04-13 → 2026-04-19',
    recipients,
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

describe('RemindersScheduler — NOTIF-01/03/04 (Phase 28-03)', () => {
  let queueAdds: Array<{ name: string; data: Record<string, unknown> }>;
  let fakeQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueAdds = [];
    fakeQueue = {
      add: vi.fn(async (name: string, data: Record<string, unknown>) => {
        queueAdds.push({ name, data });
        return { id: 'fake' };
      }),
    };
  });

  it('one lead with draft section at T-24h gets exactly one email per cycle (twice-fired tick is idempotent)', async () => {
    const recipients = [
      { userId: 'u1', email: 'lead@test.local', name: 'Lead Alpha' },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => [dueRuleFromRecipients(recipients)]),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(service, fakeRepository as never);

    // Tick #1 at 16:00 UTC — same UTC day as the deadline (2026-04-19).
    await scheduler.runOnce(new Date('2026-04-19T16:00:00.000Z'));
    expect(queueAdds).toHaveLength(1);
    expect(queueAdds[0]?.data['kind']).toBe('deadline');
    expect(queueAdds[0]?.data['recipientEmail']).toBe('lead@test.local');

    // Tick #2 at 17:00 UTC — same UTC day. Idempotent — service deduplicates
    // on the same `${rule.id}:deadline:${cycleDate}:${email}` key.
    await scheduler.runOnce(new Date('2026-04-19T17:00:00.000Z'));
    expect(queueAdds).toHaveLength(1); // STILL one — second tick was a no-op
  });

  it('no lead with draft section → zero emails', async () => {
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => []),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(service, fakeRepository as never);

    await scheduler.runOnce(new Date('2026-04-19T16:00:00.000Z'));

    expect(queueAdds).toHaveLength(0);
  });

  it('multiple leads in the same cycle → one email per lead', async () => {
    const recipients = [
      { userId: 'u1', email: 'a@test.local', name: 'Alpha' },
      { userId: 'u2', email: 'b@test.local', name: 'Beta' },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => [dueRuleFromRecipients(recipients)]),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(service, fakeRepository as never);

    await scheduler.runOnce(new Date('2026-04-19T16:00:00.000Z'));

    expect(queueAdds).toHaveLength(2);
    const emails = queueAdds.map((q) => q.data['recipientEmail']);
    expect(emails).toContain('a@test.local');
    expect(emails).toContain('b@test.local');
  });

  it('queue payload carries the rich kind="deadline" shape (leadName, reportPeriod, sectionUrl)', async () => {
    const recipients = [
      { userId: 'u1', email: 'lead@test.local', name: 'Lead Alpha' },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () => [dueRuleFromRecipients(recipients)]),
    };
    const service = new RemindersService(
      createServiceRepo(),
      undefined,
      fakeQueue as never,
    );
    const scheduler = new RemindersScheduler(service, fakeRepository as never);

    await scheduler.runOnce(new Date('2026-04-19T16:00:00.000Z'));

    const data = queueAdds[0]?.data ?? {};
    expect(data['kind']).toBe('deadline');
    expect(data['leadName']).toBe('Lead Alpha');
    expect(data['reportPeriod']).toBe('2026-04-13 → 2026-04-19');
    expect(data['deadlineIso']).toBe('2026-04-19T15:00:00.000Z');
    expect(String(data['sectionUrl'])).toContain(reportId);
  });

  it('two cycles: same lead in cycle N and N+1 receives two distinct emails', async () => {
    const recipients = [
      { userId: 'u1', email: 'lead@test.local', name: 'Lead Alpha' },
    ];
    // Cycle N — fireAt 2026-04-19.
    const ruleN: DueDeadlineRule = dueRuleFromRecipients(recipients);
    // Cycle N+1 — different rule id and fireAt 2026-04-26 (a week later).
    const ruleNplus1: DueDeadlineRule = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      reportId,
      fireAt: new Date('2026-04-26T15:00:00.000Z'),
      reportPeriodLabel: '2026-04-20 → 2026-04-26',
      recipients,
    };

    let returnNplus1 = false;
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(async () =>
        returnNplus1 ? [ruleNplus1] : [ruleN],
      ),
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

    const service = new RemindersService(serviceRepo, undefined, fakeQueue as never);
    const scheduler = new RemindersScheduler(service, fakeRepository as never);

    await scheduler.runOnce(new Date('2026-04-19T16:00:00.000Z'));
    expect(queueAdds).toHaveLength(1);

    returnNplus1 = true;
    await scheduler.runOnce(new Date('2026-04-26T16:00:00.000Z'));
    expect(queueAdds).toHaveLength(2);
  });
});
