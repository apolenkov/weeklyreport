import type { AdminReminderRule } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { formatPeriodLabel, toRuleDomain } from "./reminders-row-mappers.js";

export async function queryReminderRule(
  prisma: PrismaService,
  ruleId: string,
): Promise<AdminReminderRule | null> {
  const rule = await prisma.reminderRule.findUnique({ where: { id: ruleId } });
  return rule ? toRuleDomain(rule) : null;
}

export async function queryRulePeriodLabel(
  prisma: PrismaService,
  ruleId: string,
): Promise<string | null> {
  const rule = await prisma.reminderRule.findUnique({
    where: { id: ruleId },
    select: {
      report: { select: { periodStart: true, periodEnd: true } },
    },
  });
  return rule?.report
    ? formatPeriodLabel(rule.report.periodStart, rule.report.periodEnd)
    : null;
}
