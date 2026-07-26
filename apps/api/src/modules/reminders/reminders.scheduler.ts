import type { OrganizationBrand } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { requireEnv } from "../../lib/env.js";
import { OrganizationService } from "../organization/index.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersService } from "./reminders.service";
import type { DueDeadlineRule, DueEscalationRule } from "./reminders.types";
import { toReminderCycleDate } from "./reminders-dedupe-key.js";

// Hourly tick: deadline (T-24h) + escalation (T+2h). Escalation bypasses
// notificationOptOut. Dedupe key collapses two ticks in one UTC day to one email.
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    private readonly service: RemindersService,
    private readonly repository: RemindersPrismaRepository,
    // Brand snapshot is fetched once per `runOnce` (not per-recipient) so a
    // single tick that fans out to all 6+ leads hits the `Organization` table
    // exactly once, not 6 times.
    private readonly organizationService: OrganizationService,
  ) {}

  private logDispatchFailure(recipientUserId: string, error: unknown): void {
    this.logger.error("reminder dispatch failed for recipient", {
      recipientUserId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchDueReminders(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: drive the tick with a stubbed now.
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
    const organization: OrganizationBrand = {
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
    organization: OrganizationBrand,
  ): Promise<void> {
    const cycleDate = toReminderCycleDate(rule.fireAt);
    const sectionUrl = buildSectionUrl(rule.reportId);
    const deadlineIso = rule.fireAt.toISOString();
    for (const recipient of rule.recipients) {
      // Per-user opt-out for kind='deadline' only.
      if (recipient.notificationOptOut) {
        continue;
      }
      // Per-recipient isolation: one recipient's failure is logged and skipped
      // so the loop still processes the remaining recipients of this tick.
      try {
        await this.service.requestReminderExecution(rule.id, recipient.email, {
          kind: "deadline",
          cycleDate,
          leadName: recipient.name,
          reportPeriod: rule.reportPeriodLabel,
          deadlineIso,
          sectionUrl,
          organization,
        });
      } catch (error: unknown) {
        this.logDispatchFailure(recipient.userId, error);
      }
    }
  }

  private async dispatchEscalation(
    rule: DueEscalationRule,
    organization: OrganizationBrand,
  ): Promise<void> {
    // One digest email per (rule, group head) per cycle. Escalation always
    // notifies the head — it ignores notificationOptOut.
    const cycleDate = toReminderCycleDate(rule.fireAt);
    for (const group of rule.groups) {
      // Per-recipient isolation: one head's failure never aborts the tick.
      try {
        await this.service.requestReminderExecution(rule.id, group.head.email, {
          kind: "escalation",
          cycleDate,
          headName: group.head.name,
          reportPeriod: rule.reportPeriodLabel,
          lateLeads: group.lateLeads,
          organization,
        });
      } catch (error: unknown) {
        this.logDispatchFailure(group.head.userId, error);
      }
    }
  }
}

function buildSectionUrl(reportId: string): string {
  const base = requireEnv(process.env, "APP_BASE_URL");
  return `${base}/lead/report?reportId=${reportId}`;
}
