import type { OrganizationBrand } from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { OrganizationService } from "../organization/index.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersService } from "./reminders.service";
import type {
  DueDeadlineRule,
  DueEscalationRule,
  ReminderExecutionResult,
} from "./reminders.types";
import { toReminderCycleDate } from "./reminders-dedupe-key.js";

interface ReminderRecipientFailure {
  readonly recipientUserId: string;
  readonly error: string;
}

interface RuleDispatchOutcome {
  readonly requested: number;
  readonly failed: number;
  readonly failures: readonly ReminderRecipientFailure[];
}

export interface RemindersSchedulerResult {
  readonly requested: number;
  readonly failed: number;
  readonly failures: readonly ReminderRecipientFailure[];
}

const EMPTY_DISPATCH_RESULT: RemindersSchedulerResult = {
  requested: 0,
  failed: 0,
  failures: [],
};

// Hourly tick: policy-relative deadline and escalation reminders. Escalation
// bypasses notificationOptOut. One UTC rule cycle deduplicates repeated ticks.
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    @Inject(RemindersService) private readonly service: RemindersService,
    @Inject(RemindersPrismaRepository)
    private readonly repository: Pick<
      RemindersPrismaRepository,
      "findDueDeadlineRules" | "findDueEscalationRules"
    >,
    // Brand snapshot is fetched once per `runOnce` (not per-recipient) so a
    // single tick that fans out to all 6+ leads hits the `Organization` table
    // exactly once, not 6 times.
    @Inject(OrganizationService)
    private readonly organizationService: OrganizationService,
    // Validated boot env: APP_BASE_URL is resolved once at construction, not
    // via raw process.env at every dispatch.
    @Inject(ENV_CONFIG) private readonly env: EnvConfig,
  ) {}

  private recordDispatchFailure(
    tally: RuleDispatchOutcome,
    recipientUserId: string,
    error: unknown,
  ): RuleDispatchOutcome {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error("reminder dispatch failed for recipient", {
      recipientUserId,
      error: message,
    });
    return {
      requested: tally.requested,
      failed: tally.failed + 1,
      failures: [...tally.failures, { recipientUserId, error: message }],
    };
  }

  private recordDispatchOutcome(
    tally: RuleDispatchOutcome,
    result: ReminderExecutionResult,
    recipientUserId: string,
  ): RuleDispatchOutcome {
    if (result.outcome === "failed") {
      return this.recordDispatchFailure(
        tally,
        recipientUserId,
        result.execution.errorMessage ?? "Reminder request failed",
      );
    }
    return result.outcome === "skipped"
      ? tally
      : { ...tally, requested: tally.requested + 1 };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchDueReminders(): Promise<RemindersSchedulerResult> {
    return this.runOnce(new Date());
  }

  // Test seam: drive the tick with a stubbed now.
  async runOnce(now: Date): Promise<RemindersSchedulerResult> {
    const dueDeadlineRules = await this.repository.findDueDeadlineRules(now);
    const dueEscalationRules =
      await this.repository.findDueEscalationRules(now);

    // Due-rule queries have already run; when both return empty, skip the
    // organization read and every dispatch.
    if (dueDeadlineRules.length === 0 && dueEscalationRules.length === 0) {
      return EMPTY_DISPATCH_RESULT;
    }

    const orgPublic = await this.organizationService.getPublic();
    const organization: OrganizationBrand = {
      shortName: orgPublic.shortName,
      fullName: orgPublic.fullName,
    };

    const deadlineOutcomes: RuleDispatchOutcome[] = [];
    for (const rule of dueDeadlineRules) {
      deadlineOutcomes.push(await this.dispatchRule(rule, organization));
    }

    const escalationOutcomes: RuleDispatchOutcome[] = [];
    for (const rule of dueEscalationRules) {
      escalationOutcomes.push(
        await this.dispatchEscalation(rule, organization),
      );
    }

    const outcomes = [...deadlineOutcomes, ...escalationOutcomes];
    return {
      requested: outcomes.reduce(
        (total, outcome) => total + outcome.requested,
        0,
      ),
      failed: outcomes.reduce((total, outcome) => total + outcome.failed, 0),
      failures: outcomes.flatMap((outcome) => outcome.failures),
    };
  }

  private async dispatchRule(
    rule: DueDeadlineRule,
    organization: OrganizationBrand,
  ): Promise<RuleDispatchOutcome> {
    const cycleDate = toReminderCycleDate(rule.fireAt);
    const sectionUrl = buildSectionUrl(this.env.APP_BASE_URL, rule.reportId);
    const deadlineIso = rule.deadline.toISOString();
    // Folded sequentially — enqueue order stays deterministic and one
    // recipient's failure (counted, logged) never aborts the remaining ones.
    return rule.recipients.reduce<Promise<RuleDispatchOutcome>>(
      async (pending, recipient) => {
        const tally = await pending;
        // Per-user opt-out for kind='deadline' only.
        if (recipient.notificationOptOut) {
          return tally;
        }
        try {
          const result = await this.service.requestReminderExecutionWithOutcome(
            rule.id,
            recipient.email,
            {
              kind: "deadline",
              cycleDate,
              leadName: recipient.name,
              reportPeriod: rule.reportPeriodLabel,
              deadlineIso,
              sectionUrl,
              organization,
            },
          );
          return this.recordDispatchOutcome(tally, result, recipient.userId);
        } catch (error: unknown) {
          return this.recordDispatchFailure(tally, recipient.userId, error);
        }
      },
      Promise.resolve({ requested: 0, failed: 0, failures: [] }),
    );
  }

  private async dispatchEscalation(
    rule: DueEscalationRule,
    organization: OrganizationBrand,
  ): Promise<RuleDispatchOutcome> {
    // One digest email per (rule, group head) per cycle. Escalation always
    // notifies the head — it ignores notificationOptOut.
    const cycleDate = toReminderCycleDate(rule.fireAt);
    return rule.groups.reduce<Promise<RuleDispatchOutcome>>(
      async (pending, group) => {
        const tally = await pending;
        try {
          const result = await this.service.requestReminderExecutionWithOutcome(
            rule.id,
            group.head.email,
            {
              kind: "escalation",
              cycleDate,
              headName: group.head.name,
              reportPeriod: rule.reportPeriodLabel,
              lateLeads: group.lateLeads,
              organization,
            },
          );
          return this.recordDispatchOutcome(tally, result, group.head.userId);
        } catch (error: unknown) {
          return this.recordDispatchFailure(tally, group.head.userId, error);
        }
      },
      Promise.resolve({ requested: 0, failed: 0, failures: [] }),
    );
  }
}

function buildSectionUrl(baseUrl: string, reportId: string): string {
  return `${baseUrl}/lead/report/${encodeURIComponent(reportId)}`;
}
