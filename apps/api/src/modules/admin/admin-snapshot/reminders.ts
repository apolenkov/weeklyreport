import type { AdminSnapshot } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { PolicyApplicatorService } from "../../reminders/index.js";
import { audienceToPrisma } from "../admin-enum-mappers.js";

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
  }
}

export async function upsertReminderRules(
  tx: Prisma.TransactionClient,
  reminderRules: AdminSnapshot["reminderRules"],
  currentRules: Awaited<ReturnType<PrismaService["reminderRule"]["findMany"]>>,
): Promise<void> {
  const currentRuleIds = new Set(currentRules.map((rule) => rule.id));
  for (const rule of reminderRules) {
    const data = {
      policyId: rule.policyId,
      kind: rule.kind,
      fireAt: rule.fireAt,
      timezone: rule.timezone,
      status: rule.status,
      version: rule.version,
      reportId: rule.reportId ?? null,
    };
    await (currentRuleIds.has(rule.id)
      ? tx.reminderRule.update({ where: { id: rule.id }, data })
      : tx.reminderRule.create({ data: { id: rule.id, ...data } }));
  }
}

const restoredPolicyIdsByReport = (
  reminderRules: AdminSnapshot["reminderRules"],
): ReadonlyMap<string, ReadonlySet<string>> =>
  reminderRules.reduce<ReadonlyMap<string, ReadonlySet<string>>>(
    (byReport, rule) => {
      if (!rule.reportId || !rule.policyId) return byReport;
      const policyIds = new Set([
        ...(byReport.get(rule.reportId) ?? []),
        rule.policyId,
      ]);
      return new Map(byReport).set(rule.reportId, policyIds);
    },
    new Map(),
  );

export async function applyPoliciesToNewPeriods(
  policyApplicator: PolicyApplicatorService | undefined,
  reminderRules: AdminSnapshot["reminderRules"],
  periods: readonly NewlyCreatedPeriod[],
): Promise<void> {
  if (policyApplicator === undefined) return;
  const policyIdsByReport = restoredPolicyIdsByReport(reminderRules);
  const now = new Date();
  for (const period of periods) {
    await policyApplicator.applyToPeriod(
      period,
      now,
      policyIdsByReport.get(period.id),
    );
  }
}
