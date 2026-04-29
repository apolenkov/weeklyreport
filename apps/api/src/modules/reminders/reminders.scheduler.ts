import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RemindersService } from './reminders.service';
import {
  RemindersPrismaRepository,
  type DueDeadlineRule,
} from './reminders.prisma-repository';

/**
 * NOTIF-04 (Phase 28-03): hourly tick that dispatches T-24h deadline
 * reminders.
 *
 * The scheduler is contract-light:
 *   1. Query active deadline rules whose fireAt is in the past AND that have
 *      ≥1 lead with a 'draft' section for the rule's reportId.
 *   2. For each (rule, recipient) pair, call the existing
 *      `requestReminderExecution` with kind='deadline' payload.
 *   3. The service's idempotent dedupeKey
 *      (`${rule.id}:deadline:${cycleDate}:${email}`) collapses two ticks
 *      within one UTC day into exactly one email — even if Cron fires
 *      multiple times due to clock drift, missed-tick replay, or a hot
 *      restart.
 *
 * Out of scope per CONTEXT.md:
 *   - NOTIF-02 escalation T+2h → Phase 29.
 *   - NOTIF-05 per-user opt-out → Phase 29.
 *   - NOTIF-06 BullMQ rate-limiter → Phase 29.
 */
@Injectable()
export class RemindersScheduler {
  constructor(
    private readonly service: RemindersService,
    private readonly repository: RemindersPrismaRepository,
  ) {}

  // CronExpression.EVERY_HOUR === '0 * * * *' — fires at the top of every hour.
  @Cron(CronExpression.EVERY_HOUR)
  async dispatchDueDeadlineReminders(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Scheduler-internal entry point. Exposed for unit tests so we can drive
   * the tick deterministically with a stubbed `now`.
   */
  async runOnce(now: Date): Promise<void> {
    const dueRules = await this.repository.findDueDeadlineRules(now);
    for (const rule of dueRules) {
      await this.dispatchRule(rule);
    }
  }

  private async dispatchRule(rule: DueDeadlineRule): Promise<void> {
    const cycleDate = rule.fireAt.toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const sectionUrl = buildSectionUrl(rule.reportId);
    const deadlineIso = rule.fireAt.toISOString();
    for (const recipient of rule.recipients) {
      await this.service.requestReminderExecution(rule.id, recipient.email, {
        kind: 'deadline',
        cycleDate,
        leadName: recipient.name,
        reportPeriod: rule.reportPeriodLabel,
        deadlineIso,
        sectionUrl,
      });
    }
  }
}

function buildSectionUrl(reportId: string): string {
  const base = process.env['APP_BASE_URL'] ?? 'http://localhost:3000';
  return `${base}/lead/report?reportId=${reportId}`;
}
