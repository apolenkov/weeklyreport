import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { requireEnv } from "../../lib/env.js";
import { OrganizationService } from "../organization/organization.service";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import type {
  DueDeadlineRule,
  DueEscalationRule,
  ReminderOrganization,
} from "./reminders.service";
import { RemindersService } from "./reminders.service";

/** Length of an ISO calendar date (`YYYY-MM-DD`) after `toISOString().slice(0, n)`. */
const ISO_DATE_LENGTH = 10;

/**
 * Hourly tick that dispatches T-24h deadline reminders AND T+2h escalation
 * digests in one scheduler pass.
 *
 * The scheduler is contract-light:
 *   1. Query active deadline rules whose fireAt is in the past AND that have
 *      ≥1 lead with a 'draft' section for the rule's reportId.
 *   2. For each (rule, recipient) pair, call the existing
 *      `requestReminderExecution` with kind='deadline' payload — UNLESS the
 *      recipient has notificationOptOut=true.
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
    // Brand snapshot is fetched once per `runOnce` (not per-recipient) so a
    // single tick that fans out to all 6+ leads hits the `Organization` table
    // exactly once, not 6 times.
    private readonly organizationService: OrganizationService,
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
    const dueEscalationRules =
      await this.repository.findDueEscalationRules(now);

    // Skip the org fetch entirely when nothing is due — keeps idle ticks
    // a no-op against the DB.
    if (dueDeadlineRules.length === 0 && dueEscalationRules.length === 0) {
      return;
    }

    const orgPublic = await this.organizationService.getPublic();
    const organization: ReminderOrganization = {
      shortName: orgPublic.shortName,
      fullName: orgPublic.fullName,
    };

    for (const rule of dueDeadlineRules) {
      await this.dispatchRule(rule, organization);
    }

    for (const rule of dueEscalationRules) {
      await this.dispatchEscalation(rule, organization);
    }
  }

  private async dispatchRule(
    rule: DueDeadlineRule,
    organization: ReminderOrganization,
  ): Promise<void> {
    const cycleDate = rule.fireAt.toISOString().slice(0, ISO_DATE_LENGTH); // YYYY-MM-DD UTC
    const sectionUrl = buildSectionUrl(rule.reportId);
    const deadlineIso = rule.fireAt.toISOString();
    for (const recipient of rule.recipients) {
      // Per-user opt-out for kind='deadline' only.
      if (recipient.notificationOptOut) {
        continue;
      }
      await this.service.requestReminderExecution(rule.id, recipient.email, {
        kind: "deadline",
        cycleDate,
        leadName: recipient.name,
        reportPeriod: rule.reportPeriodLabel,
        deadlineIso,
        sectionUrl,
        organization,
      });
    }
  }

  private async dispatchEscalation(
    rule: DueEscalationRule,
    organization: ReminderOrganization,
  ): Promise<void> {
    // One digest email per (rule, group head) per cycle. Escalation always
    // notifies the head — it ignores notificationOptOut.
    const cycleDate = rule.fireAt.toISOString().slice(0, ISO_DATE_LENGTH);
    for (const group of rule.groups) {
      await this.service.requestReminderExecution(rule.id, group.head.email, {
        kind: "escalation",
        cycleDate,
        headName: group.head.name,
        reportPeriod: rule.reportPeriodLabel,
        lateLeads: group.lateLeads,
        organization,
      });
    }
  }
}

function buildSectionUrl(reportId: string): string {
  const base = requireEnv(process.env, "APP_BASE_URL");
  return `${base}/lead/report?reportId=${reportId}`;
}
