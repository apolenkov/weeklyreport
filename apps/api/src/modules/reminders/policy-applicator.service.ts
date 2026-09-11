import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  lockAllReminderPolicies,
  lockReminderReport,
  reconcileLockedPolicyForReport,
  repairMissingRuleForLockedReport,
} from "./reminder-rule-reconcile.prisma.js";

type PolicyApplyTally = Record<"created" | "skipped" | "updated", number>;

// Reconciles every policy against one persisted Report in a single transaction.
// The caller supplies only report identity; deadline and lifecycle are re-read
// after policy locks so a concurrent admin edit cannot materialize stale rules.
@Injectable()
export class PolicyApplicatorService {
  private readonly logger = new Logger(PolicyApplicatorService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async applyToPeriod(
    reportId: string,
    now?: Date,
    excludePolicyIds?: ReadonlySet<string>,
  ): Promise<PolicyApplyTally> {
    return this.reconcilePeriod(reportId, now, excludePolicyIds);
  }

  async repairToPeriod(reportId: string): Promise<PolicyApplyTally> {
    return this.prisma.$transaction(async (tx) => {
      const policies = await lockAllReminderPolicies(tx);
      const report = await lockReminderReport(tx, reportId);
      const tally: PolicyApplyTally = { created: 0, updated: 0, skipped: 0 };
      if (!report) return { ...tally, skipped: policies.length };
      for (const policy of policies) {
        const outcome = await repairMissingRuleForLockedReport(
          tx,
          policy,
          report,
        );
        tally[outcome] += 1;
      }
      return tally;
    });
  }

  private async reconcilePeriod(
    reportId: string,
    now: Date | undefined,
    excludePolicyIds?: ReadonlySet<string>,
  ): Promise<PolicyApplyTally> {
    const tally = await this.prisma.$transaction(async (tx) => {
      // Shared lock order: policies sorted, then the owning Report, then rules.
      const policies = await lockAllReminderPolicies(tx);
      const report = await lockReminderReport(tx, reportId);
      if (!report) {
        return { created: 0, updated: 0, skipped: policies.length };
      }

      const result: PolicyApplyTally = {
        created: 0,
        updated: 0,
        skipped: 0,
      };
      for (const policy of policies) {
        const outcome = excludePolicyIds?.has(policy.id)
          ? "skipped"
          : await reconcileLockedPolicyForReport(tx, policy, report, now);
        result[outcome] += 1;
      }
      return result;
    });

    this.logger.log(
      `reconcilePeriod report=${reportId}: created=${tally.created} updated=${tally.updated} skipped=${tally.skipped}`,
    );
    return tally;
  }
}
