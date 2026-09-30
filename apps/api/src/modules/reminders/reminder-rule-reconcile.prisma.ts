import type { ReminderRecoverySnapshot } from "@customreport/shared";
import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@customreport/shared";
import type { Prisma, ReminderPolicy, ReminderRule } from "@prisma/client";

type LockedReminderReport = ReminderRecoverySnapshot["periods"][number];

type ReminderRuleReconcileOutcome = "created" | "skipped" | "updated";

export async function lockAllReminderPolicies(
  tx: Prisma.TransactionClient,
): Promise<ReminderPolicy[]> {
  return tx.$queryRaw<ReminderPolicy[]>`
    SELECT *
    FROM "ReminderPolicy"
    ORDER BY "id"
    FOR UPDATE
  `;
}

export async function lockReminderPolicy(
  tx: Prisma.TransactionClient,
  policyId: string,
): Promise<ReminderPolicy | null> {
  const rows = await tx.$queryRaw<ReminderPolicy[]>`
    SELECT *
    FROM "ReminderPolicy"
    WHERE "id" = ${policyId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockReminderReport(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<LockedReminderReport | null> {
  const rows = await tx.$queryRaw<LockedReminderReport[]>`
    SELECT "id", "deadline", "periodState", "status", "periodStatus", "archived"
    FROM "Report"
    WHERE "id" = ${reportId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockLiveReminderReports(
  tx: Prisma.TransactionClient,
): Promise<LockedReminderReport[]> {
  return tx.$queryRaw<LockedReminderReport[]>`
    SELECT "id", "deadline", "periodState", "status", "periodStatus", "archived"
    FROM "Report"
    WHERE "archived" = false
      AND (
        ("periodState" = 'scheduled' AND "status" = 'draft' AND "periodStatus" = 'open')
        OR
        ("periodState" = 'open' AND "status" = 'draft' AND "periodStatus" = 'open')
        OR
        ("periodState" = 'open' AND "status" = 'published' AND "periodStatus" = 'reopened')
      )
    ORDER BY "id"
    FOR UPDATE
  `;
}

export function pauseReminderRulesForReport(
  tx: Prisma.TransactionClient,
  reportId: string,
) {
  return tx.reminderRule.updateMany({
    where: { reportId, status: "active" },
    data: { status: "paused" },
  });
}

// Caller must already hold the sorted policy locks. Re-reading the Report with
// FOR UPDATE makes the lifecycle transition and rule state one atomic unit.
export async function synchronizeReminderRulesForReport(
  tx: Prisma.TransactionClient,
  policies: readonly ReminderPolicy[],
  reportId: string,
  now?: Date,
): Promise<void> {
  const report = await lockReminderReport(tx, reportId);
  if (!report) return;
  if (!isLiveReport(report)) {
    await pauseReminderRulesForReport(tx, reportId);
    return;
  }
  for (const policy of policies) {
    await reconcileLockedPolicyForReport(tx, policy, report, now);
  }
}

function isLiveReport(report: LockedReminderReport): boolean {
  return (
    !report.archived &&
    ((report.periodState === "scheduled" &&
      report.status === "draft" &&
      report.periodStatus === "open") ||
      (report.periodState === "open" &&
        report.status === "draft" &&
        report.periodStatus === "open") ||
      (report.periodState === "open" &&
        report.status === "published" &&
        report.periodStatus === "reopened"))
  );
}

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

type CurrentReminderRule = ReminderRule & {
  readonly _count: { readonly executions: number };
};

interface ReminderRuleSchedule {
  readonly policy: ReminderPolicy;
  readonly report: LockedReminderReport & { readonly deadline: Date };
  readonly fireAt: Date;
  readonly status: "active" | "paused";
}

function ruleScheduleChanged(
  current: CurrentReminderRule,
  policy: ReminderPolicy,
  deadline: Date,
  fireAt: Date,
): boolean {
  return (
    current.kind !== policy.kind ||
    current.timezone !== policy.timezone ||
    !sameInstant(current.fireAt, fireAt) ||
    !sameInstant(current.deadline, deadline)
  );
}

function createRuleVersion(
  tx: Prisma.TransactionClient,
  { policy, report, fireAt, status }: ReminderRuleSchedule,
  version: number,
) {
  return tx.reminderRule.create({
    data: {
      reportId: report.id,
      policyId: policy.id,
      kind: policy.kind,
      fireAt,
      deadline: report.deadline,
      timezone: policy.timezone,
      status,
      version,
    },
  });
}

async function reconcileCurrentRule(
  tx: Prisma.TransactionClient,
  current: CurrentReminderRule,
  schedule: ReminderRuleSchedule,
): Promise<ReminderRuleReconcileOutcome> {
  const { policy, report, fireAt, status } = schedule;
  const identityChanged = ruleScheduleChanged(
    current,
    policy,
    report.deadline,
    fireAt,
  );
  if (identityChanged && current._count.executions > 0) {
    if (current.status !== "paused") {
      await tx.reminderRule.update({
        where: { id: current.id },
        data: { status: "paused" },
      });
    }
    await createRuleVersion(tx, schedule, current.version + 1);
    return "created";
  }

  if (!identityChanged && current.status === status) return "skipped";
  await tx.reminderRule.update({
    where: { id: current.id },
    data: identityChanged
      ? {
          kind: policy.kind,
          fireAt,
          deadline: report.deadline,
          timezone: policy.timezone,
          status,
        }
      : { status },
  });
  return "updated";
}

// Recovery preserves every existing version, including deliberately paused rules.
// Caller holds sorted policy locks followed by the owning Report lock.
export async function repairMissingRuleForLockedReport(
  tx: Prisma.TransactionClient,
  policy: ReminderPolicy,
  report: LockedReminderReport,
): Promise<"created" | "skipped"> {
  const existing = await tx.reminderRule.findFirst({
    where: { reportId: report.id, policyId: policy.id },
    select: { id: true },
  });
  if (existing || !isLiveReport(report) || report.deadline === null)
    return "skipped";
  const now = new Date();
  if (!reminderPolicyAppliesTo(policy, report.deadline)) return "skipped";
  const fireAt = computeReminderFireAt(report.deadline, policy.offsetMinutes);
  if (fireAt.getTime() <= now.getTime()) return "skipped";
  await createRuleVersion(
    tx,
    {
      policy,
      report: { ...report, deadline: report.deadline },
      fireAt,
      status: "active",
    },
    1,
  );
  return "created";
}

export async function reconcileLockedPolicyForReport(
  tx: Prisma.TransactionClient,
  policy: ReminderPolicy,
  report: LockedReminderReport,
  now?: Date,
): Promise<ReminderRuleReconcileOutcome> {
  const current = await tx.reminderRule.findFirst({
    where: { reportId: report.id, policyId: policy.id },
    orderBy: { version: "desc" },
    include: { _count: { select: { executions: true } } },
  });

  if (!isLiveReport(report) || report.deadline === null) {
    if (!current || current.status === "paused") return "skipped";
    await tx.reminderRule.update({
      where: { id: current.id },
      data: { status: "paused" },
    });
    return "updated";
  }
  const schedulableReport = { ...report, deadline: report.deadline };

  const fireAt = computeReminderFireAt(
    schedulableReport.deadline,
    policy.offsetMinutes,
  );
  const active =
    reminderPolicyAppliesTo(policy, schedulableReport.deadline) &&
    (now === undefined || fireAt.getTime() > now.getTime());

  if (!current && !active) return "skipped";
  if (!current) {
    await createRuleVersion(
      tx,
      {
        policy,
        report: schedulableReport,
        fireAt,
        status: "active",
      },
      1,
    );
    return "created";
  }

  await tx.reminderRule.updateMany({
    where: {
      reportId: report.id,
      policyId: policy.id,
      version: { lt: current.version },
      status: "active",
    },
    data: { status: "paused" },
  });

  const status = active ? ("active" as const) : ("paused" as const);
  return reconcileCurrentRule(tx, current, {
    policy,
    report: schedulableReport,
    fireAt,
    status,
  });
}
