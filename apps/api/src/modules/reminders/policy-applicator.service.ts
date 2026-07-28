import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { ReminderPolicy } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

type PolicyApplyOutcome = "created" | "skipped" | "updated";
type PolicyApplyTally = Record<PolicyApplyOutcome, number>;

// Turns ReminderPolicy templates into ReminderRule rows for one Period.
// Idempotent via upsert on uq_rule_report_policy; P2002 is still caught in case
// an older database is missing that unique index.
@Injectable()
export class PolicyApplicatorService {
  private readonly logger = new Logger(PolicyApplicatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // With `now` supplied, a rule whose `fireAt` is already past is skipped instead
  // of created active: the scheduler fires any active rule with `fireAt <= now`,
  // so a late-created period would otherwise dispatch stale reminders.
  async applyToPeriod(
    period: {
      id: string;
      deadline: Date;
    },
    now?: Date,
    excludePolicyIds?: ReadonlySet<string>,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const policies = await this.prisma.reminderPolicy.findMany({
      where: { active: true },
    });

    const tally = await this.collectPolicyTally(
      policies,
      period,
      now,
      excludePolicyIds,
    );

    this.logger.log(
      `applyToPeriod period=${period.id}: created=${tally.created} updated=${tally.updated} skipped=${tally.skipped}`,
    );
    return tally;
  }

  // Sequential: each policy's findUnique-then-upsert must finish before the next
  // so P2002 recovery cannot interleave with a sibling write.
  private async collectPolicyTally(
    remaining: readonly ReminderPolicy[],
    period: { id: string; deadline: Date },
    now: Date | undefined,
    excludePolicyIds: ReadonlySet<string> | undefined,
  ): Promise<PolicyApplyTally> {
    return remaining.reduce<Promise<PolicyApplyTally>>(
      async (tallyPromise, policy) => {
        const tally = await tallyPromise;
        const outcome = await this.applyPolicyToPeriod(
          policy,
          period,
          now,
          excludePolicyIds,
        );
        return { ...tally, [outcome]: tally[outcome] + 1 };
      },
      Promise.resolve({ created: 0, skipped: 0, updated: 0 }),
    );
  }

  // Validity/elapsed gate then upsert; concurrent P2002 races report as "skipped".
  private async applyPolicyToPeriod(
    policy: ReminderPolicy,
    period: { id: string; deadline: Date },
    now: Date | undefined,
    excludePolicyIds: ReadonlySet<string> | undefined,
  ): Promise<PolicyApplyOutcome> {
    // Snapshot restore passes the pairs its own transaction just wrote:
    // re-materializing those would clobber the restored rows' status and
    // fireAt (e.g. force a deliberately paused rule back to active).
    if (excludePolicyIds?.has(policy.id)) {
      return "skipped";
    }
    const fireAt = computeReminderFireAt(
      period.deadline,
      policy.offsetMinutes,
      policy.timezone,
    );
    // Skip a policy outside its validity window, or — when `now` is given —
    // one whose instant has already elapsed (it would fire stale, since the
    // scheduler has no elapsed-fireAt lower bound). One gate, one skip path.
    const elapsed = now !== undefined && fireAt.getTime() <= now.getTime();
    if (!reminderPolicyAppliesTo(policy, period.deadline) || elapsed) {
      return "skipped";
    }
    return this.upsertRuleForPolicy(policy, period, fireAt);
  }

  // findUnique runs before the upsert purely so the tally can distinguish
  // created from updated; both share one try so a concurrent P2002 from either
  // is recovered as "skipped".
  private async upsertRuleForPolicy(
    policy: ReminderPolicy,
    period: { id: string; deadline: Date },
    fireAt: Date,
  ): Promise<PolicyApplyOutcome> {
    try {
      const existing = await this.prisma.reminderRule.findUnique({
        where: {
          reportId_policyId: { reportId: period.id, policyId: policy.id },
        },
        select: { id: true },
      });

      await this.prisma.reminderRule.upsert({
        where: {
          reportId_policyId: { reportId: period.id, policyId: policy.id },
        },
        create: {
          reportId: period.id,
          policyId: policy.id,
          fireAt,
          kind: policy.kind,
          timezone: policy.timezone,
          status: "active",
        },
        update: {
          fireAt,
          kind: policy.kind,
          timezone: policy.timezone,
          status: "active",
        },
      });

      return existing ? "updated" : "created";
    } catch (error: unknown) {
      // Concurrent applyToPeriod on the same (reportId, policyId): log and continue.
      if (isUniqueViolation(error)) {
        this.logger.warn(
          `applyToPeriod race on (period=${period.id}, policy=${policy.id}); rule already exists`,
        );
        return "skipped";
      }
      throw error;
    }
  }
}
