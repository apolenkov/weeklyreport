import { Prisma } from "@prisma/client";

import { AdminSnapshotConflictError } from "../admin-errors.js";

export interface LockedReminderRule {
  id: string;
  reportId: string;
  kind: string;
  fireAt: Date;
  deadline: Date;
  policyId: string;
  timezone: string;
  version: number;
  _count: { executions: number };
}

async function lockPolicies(
  tx: Prisma.TransactionClient,
  policyIds: readonly string[],
): Promise<void> {
  const orderedIds = [...policyIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (orderedIds.length === 0) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "ReminderPolicy"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id" FOR UPDATE
  `);
}

async function lockAndReadRules(
  tx: Prisma.TransactionClient,
  ruleIds: readonly string[],
  policyIds: readonly string[],
  reportIds: readonly string[],
): Promise<LockedReminderRule[]> {
  const orderedIds = [...ruleIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const orderedPolicyIds = [...policyIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const orderedReportIds = [...reportIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (
    orderedIds.length + orderedPolicyIds.length + orderedReportIds.length ===
    0
  ) {
    return [];
  }
  const lockConditions = [
    ...(orderedIds.length > 0
      ? [Prisma.sql`"id" IN (${Prisma.join(orderedIds)})`]
      : []),
    ...(orderedPolicyIds.length > 0
      ? [Prisma.sql`"policyId" IN (${Prisma.join(orderedPolicyIds)})`]
      : []),
    ...(orderedReportIds.length > 0
      ? [Prisma.sql`"reportId" IN (${Prisma.join(orderedReportIds)})`]
      : []),
  ];
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "ReminderRule"
    WHERE ${Prisma.join(lockConditions, " OR ")}
    ORDER BY "id" FOR UPDATE
  `);
  return tx.reminderRule.findMany({
    where: {
      OR: [
        ...(orderedIds.length > 0 ? [{ id: { in: orderedIds } }] : []),
        ...(orderedPolicyIds.length > 0
          ? [{ policyId: { in: orderedPolicyIds } }]
          : []),
        ...(orderedReportIds.length > 0
          ? [{ reportId: { in: orderedReportIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      reportId: true,
      kind: true,
      fireAt: true,
      deadline: true,
      policyId: true,
      timezone: true,
      version: true,
      _count: { select: { executions: true } },
    },
  });
}

/** Locks target and current source policies before recovery rule mutation. */
export async function lockReminderRestoreGraph(
  tx: Prisma.TransactionClient,
  ruleIds: readonly string[],
  targetPolicyIds: readonly string[],
  reportIds: readonly string[] = [],
): Promise<LockedReminderRule[]> {
  const currentOwners =
    ruleIds.length === 0 && reportIds.length === 0
      ? []
      : await tx.reminderRule.findMany({
          where: {
            OR: [
              ...(ruleIds.length > 0 ? [{ id: { in: [...ruleIds] } }] : []),
              ...(reportIds.length > 0
                ? [{ reportId: { in: [...reportIds] } }]
                : []),
            ],
          },
          select: { policyId: true },
        });
  const policyIds = [
    ...new Set([
      ...targetPolicyIds,
      ...currentOwners.map((owner) => owner.policyId),
    ]),
  ].sort((left, right) => left.localeCompare(right));
  await lockPolicies(tx, policyIds);
  const currentRules = await lockAndReadRules(
    tx,
    ruleIds,
    policyIds,
    reportIds,
  );
  const lockedPolicyIds = new Set(policyIds);
  const movedRule = currentRules.find(
    (rule) => ruleIds.includes(rule.id) && !lockedPolicyIds.has(rule.policyId),
  );
  if (movedRule) {
    throw new AdminSnapshotConflictError(
      `Reminder rule ${movedRule.id} changed policy ownership during recovery lock acquisition.`,
    );
  }
  return currentRules;
}
