import { Prisma } from "@prisma/client";
import {
  type AdminSnapshot,
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@weeklyreport/shared";

import type { PolicyApplicatorService } from "../../reminders/index.js";
import { audienceToPrisma } from "../admin-enum-mappers.js";
import { AdminSnapshotConflictError } from "../admin-errors.js";

interface CurrentReminderRule {
  readonly id: string;
  readonly reportId: string;
  readonly kind: string;
  readonly fireAt: Date;
  readonly deadline: Date;
  readonly policyId: string;
  readonly timezone: string;
  readonly version: number;
  readonly _count: { readonly executions: number };
}

export interface NewlyCreatedPeriod {
  id: string;
  deadline: Date;
}

export async function upsertReminderPolicies(
  tx: Prisma.TransactionClient,
  policies: AdminSnapshot["policies"],
): Promise<void> {
  for (const policy of policies) {
    const data = {
      kind: policy.kind,
      offsetMinutes: policy.offsetMinutes,
      timezone: policy.timezone,
      audience: audienceToPrisma[policy.audience],
      active: policy.active,
      validFrom: policy.validFrom,
      validUntil: policy.validUntil,
    };
    await tx.reminderPolicy.upsert({
      where: { id: policy.id },
      create: { id: policy.id, ...data },
      update: data,
    });
    if (!policy.active) {
      // Restore is additive, so rules omitted from the snapshot remain live.
      // A disabled restored policy must make every retained version ineligible.
      await tx.reminderRule.updateMany({
        where: { policyId: policy.id },
        data: { status: "paused" },
      });
    }
  }
}

export async function upsertReminderRules(
  tx: Prisma.TransactionClient,
  reminderRules: AdminSnapshot["reminderRules"],
  currentRules: readonly CurrentReminderRule[],
): Promise<void> {
  const currentRulesById = new Map(currentRules.map((rule) => [rule.id, rule]));
  for (const rule of reminderRules) {
    const currentRule = currentRulesById.get(rule.id);
    if (
      currentRule &&
      currentRule._count.executions > 0 &&
      (currentRule.reportId !== rule.reportId ||
        currentRule.policyId !== rule.policyId ||
        currentRule.kind !== rule.kind ||
        currentRule.fireAt.getTime() !== rule.fireAt.getTime() ||
        currentRule.deadline.getTime() !== rule.deadline.getTime() ||
        currentRule.timezone !== rule.timezone ||
        currentRule.version !== rule.version)
    ) {
      throw new AdminSnapshotConflictError(
        `Reminder rule ${rule.id} cannot change delivery identity while executions are retained.`,
      );
    }
    const data = {
      policyId: rule.policyId,
      kind: rule.kind,
      fireAt: rule.fireAt,
      deadline: rule.deadline,
      timezone: rule.timezone,
      status: rule.status,
      version: rule.version,
      reportId: rule.reportId,
    };
    await (currentRule
      ? tx.reminderRule.update({ where: { id: rule.id }, data })
      : tx.reminderRule.create({ data: { id: rule.id, ...data } }));
  }
}

function isLiveReminderReport(report: {
  readonly archived: boolean;
  readonly periodState: string;
  readonly periodStatus: string;
  readonly status: string;
}): boolean {
  return (
    !report.archived &&
    ((report.periodState === "scheduled" &&
      report.status === "draft" &&
      report.periodStatus === "open") ||
      (report.periodState === "open" &&
        ((report.status === "draft" && report.periodStatus === "open") ||
          (report.status === "published" &&
            report.periodStatus === "reopened"))))
  );
}

interface RestoredRuleStatusRow {
  readonly id: string;
  readonly reportId: string;
  readonly policyId: string;
  readonly kind: string;
  readonly fireAt: Date;
  readonly deadline: Date;
  readonly timezone: string;
  readonly status: "active" | "paused";
  readonly version: number;
  readonly report: {
    readonly deadline: Date | null;
    readonly status: string;
    readonly periodState: string;
    readonly periodStatus: string;
    readonly archived: boolean;
  };
  readonly policy: {
    readonly kind: string;
    readonly offsetMinutes: number;
    readonly timezone: string;
    readonly active: boolean;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
  };
}

type SnapshotPolicy = AdminSnapshot["policies"][number];
type SchedulePolicy = Pick<
  SnapshotPolicy,
  "kind" | "offsetMinutes" | "timezone" | "active" | "validFrom" | "validUntil"
>;

function latestRuleIsCompatible(
  rule: RestoredRuleStatusRow,
  policy: SchedulePolicy | undefined,
): boolean {
  const { report } = rule;
  if (!policy || !isLiveReminderReport(report) || report.deadline === null) {
    return false;
  }
  const expectedFireAt = computeReminderFireAt(
    report.deadline,
    policy.offsetMinutes,
  );
  return (
    rule.kind === policy.kind &&
    rule.timezone === policy.timezone &&
    rule.deadline.getTime() === report.deadline.getTime() &&
    rule.fireAt.getTime() === expectedFireAt.getTime() &&
    reminderPolicyAppliesTo(policy, report.deadline)
  );
}

function pauseIdsForOwner(
  rules: readonly RestoredRuleStatusRow[],
  policyById: ReadonlyMap<string, SchedulePolicy>,
): readonly string[] {
  const latest = rules.at(-1);
  if (!latest) return [];
  const historicalIds = rules
    .slice(0, -1)
    .filter((rule) => rule.status === "active")
    .map((rule) => rule.id);
  const pauseLatest =
    latest.status === "active" &&
    !latestRuleIsCompatible(latest, policyById.get(latest.policyId));
  return pauseLatest ? [...historicalIds, latest.id] : historicalIds;
}

/** Pauses retained or superseded rules that an additive restore cannot expose. */
export async function reconcileRestoredReminderRuleStatuses(
  tx: Prisma.TransactionClient,
  policies: AdminSnapshot["policies"],
  reportIds: readonly string[] = [],
): Promise<void> {
  const activePolicies = policies.filter((policy) => policy.active);
  if (activePolicies.length === 0 && reportIds.length === 0) return;

  const rules: readonly RestoredRuleStatusRow[] =
    await tx.reminderRule.findMany({
      where: {
        OR: [
          ...(activePolicies.length > 0
            ? [{ policyId: { in: activePolicies.map((policy) => policy.id) } }]
            : []),
          ...(reportIds.length > 0
            ? [{ reportId: { in: [...reportIds] } }]
            : []),
        ],
      },
      orderBy: [{ policyId: "asc" }, { reportId: "asc" }, { version: "asc" }],
      include: {
        report: {
          select: {
            deadline: true,
            status: true,
            periodState: true,
            periodStatus: true,
            archived: true,
          },
        },
        policy: {
          select: {
            kind: true,
            offsetMinutes: true,
            timezone: true,
            active: true,
            validFrom: true,
            validUntil: true,
          },
        },
      },
    });
  const policyById = new Map<string, SchedulePolicy>(
    activePolicies.map((policy) => [policy.id, policy]),
  );
  for (const rule of rules) {
    if (!policyById.has(rule.policyId))
      policyById.set(rule.policyId, rule.policy as SchedulePolicy);
  }
  const rulesByOwner = Map.groupBy(
    rules,
    (rule) => `${rule.reportId}\u0000${rule.policyId}`,
  );
  const pauseIds = [...rulesByOwner.values()].flatMap((ownerRules) =>
    pauseIdsForOwner(ownerRules, policyById),
  );

  if (pauseIds.length > 0) {
    await tx.reminderRule.updateMany({
      where: { id: { in: pauseIds }, status: "active" },
      data: { status: "paused" },
    });
  }
}

const restoredPolicyIdsByReport = (
  reminderRules: AdminSnapshot["reminderRules"],
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    [...Map.groupBy(reminderRules, (rule) => rule.reportId)].map(
      ([reportId, rules]) => [
        reportId,
        new Set(rules.map((rule) => rule.policyId)),
      ],
    ),
  );

export interface PostCommitPolicyFailure {
  readonly periodId: string;
  readonly error: string;
}

// Runs after the restore transaction commits: one period's applicator failure
// must not skip the rest or fail the already-committed restore. Failures are
// returned so the caller can log them; the hourly missing-rule repair sweep
// converges them later.
export async function applyPoliciesToNewPeriods(
  policyApplicator: PolicyApplicatorService | undefined,
  reminderRules: AdminSnapshot["reminderRules"],
  periods: readonly NewlyCreatedPeriod[],
): Promise<PostCommitPolicyFailure[]> {
  const failures: PostCommitPolicyFailure[] = [];
  if (policyApplicator === undefined) return failures;
  const policyIdsByReport = restoredPolicyIdsByReport(reminderRules);
  const now = new Date();
  for (const period of periods) {
    try {
      await policyApplicator.applyToPeriod(
        period.id,
        now,
        policyIdsByReport.get(period.id),
      );
    } catch (error: unknown) {
      failures.push({
        periodId: period.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return failures;
}
