import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RemindersService } from './reminders.service';
import {
  RemindersPrismaRepository,
  type DueDeadlineRule,
  type DueEscalationRule,
} from './reminders.prisma-repository';

/**
 * NOTIF-04 (Phase 28-03), NOTIF-02/05 (Phase 29-05): hourly tick that
 * dispatches T-24h deadline reminders AND T+2h escalation digests in one
 * scheduler pass.
 *
 * The scheduler is contract-light:
 *   1. Query active deadline rules whose fireAt is in the past AND that have
 *      ≥1 lead with a 'draft' section for the rule's reportId.
 *   2. For each (rule, recipient) pair, call the existing
 *      `requestReminderExecution` with kind='deadline' payload — UNLESS the
 *      recipient has notificationOptOut=true (NOTIF-05).
 *   3. Query active escalation rules whose fireAt is in the past AND that
 *      have ≥1 late lead. For each (rule, head) pair, call
 *      `requestReminderExecution` once with kind='escalation' digest payload.
 *      Escalation BYPASSES notificationOptOut — heads always notified.
 *   4. The service's idempotent dedupeKey
 *      (`${rule.id}:${kind}:${cycleDate}:${email}`) collapses two ticks
 *      within one UTC day into exactly one email per (rule, recipient, day).
 */
@Injectable()
export class RemindersScheduler {
  constructor(
    private readonly service: RemindersService,
    private readonly repository: RemindersPrismaRepository,
  ) {}

  // CronExpression.EVERY_HOUR === '0 * * * *' — fires at the top of every hour.
  // The same tick handles deadline (T-24h) and escalation (T+2h).
  @Cron(CronExpression.EVERY_HOUR)
  async dispatchDueReminders(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Scheduler-internal entry point. Exposed for unit tests so we can drive
   * the tick deterministically with a stubbed `now`.
   */
  async runOnce(now: Date): Promise<void> {
    const dueDeadlineRules = await this.repository.findDueDeadlineRules(now);
    for (const rule of dueDeadlineRules) {
      await this.dispatchRule(rule);
    }

    const dueEscalationRules = await this.repository.findDueEscalationRules(now);
    for (const rule of dueEscalationRules) {
      await this.dispatchEscalation(rule);
    }
  }

  private async dispatchRule(rule: DueDeadlineRule): Promise<void> {
    const cycleDate = rule.fireAt.toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const sectionUrl = buildSectionUrl(rule.reportId);
    const deadlineIso = rule.fireAt.toISOString();
    for (const recipient of rule.recipients) {
      // NOTIF-05 (Phase 29-05): per-user opt-out for kind='deadline' only.
      if (recipient.notificationOptOut) {
        continue;
      }
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

  private async dispatchEscalation(rule: DueEscalationRule): Promise<void> {
    // NOTIF-02 (Phase 29-05): one digest email per (rule, head) per cycle.
    // Escalation IGNORES recipient.notificationOptOut (NOTIF-05 contract).
    const cycleDate = rule.fireAt.toISOString().slice(0, 10);
    await this.service.requestReminderExecution(rule.id, rule.head.email, {
      kind: 'escalation',
      cycleDate,
      headName: rule.head.name,
      reportPeriod: rule.reportPeriodLabel,
      lateLeads: rule.lateLeads,
    });
  }
}

function buildSectionUrl(reportId: string): string {
  const base = process.env['APP_BASE_URL'] ?? 'http://localhost:3000';
  return `${base}/lead/report?reportId=${reportId}`;
}
