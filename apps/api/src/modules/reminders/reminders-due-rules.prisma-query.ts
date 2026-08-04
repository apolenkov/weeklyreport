import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { DueDeadlineRule, DueEscalationRule } from "./reminders.types.js";
import { buildEscalationGroups } from "./reminders-escalation-grouping.js";
import { formatPeriodLabel } from "./reminders-row-mappers.js";

// Minimal logging surface `queryDueEscalationRules` needs — matches both NestJS
// `Logger` and `AppLogger`.
export interface UnresolvedGroupLogger {
  readonly warn: (message: string) => void;
}

// Period identity plus the still-draft sections' authors — the leads a deadline
// reminder is addressed to.
const deadlineRecipientsInclude = {
  report: {
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      sections: {
        where: { status: "draft" },
        select: {
          authorId: true,
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              notificationOptOut: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ReminderRuleInclude;

// Adds the deadline and each late lead's reporting-group head, the routing
// target an escalation digest fans out to.
const escalationRoutingInclude = {
  report: {
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      sections: {
        where: { status: "draft" },
        select: {
          author: {
            select: {
              name: true,
              reportingGroup: {
                select: {
                  name: true,
                  head: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      isActive: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ReminderRuleInclude;

export async function queryDueDeadlineRules(
  prisma: PrismaService,
  now: Date,
): Promise<DueDeadlineRule[]> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      status: "active",
      kind: "deadline",
      fireAt: { lte: now },
      reportId: { not: null },
      // Cleared deadlines remove the reminder reference point; archived periods
      // are out of scope even though their rules remain active, so exclude both.
      report: { deadline: { not: null }, archived: false },
    },
    include: deadlineRecipientsInclude,
  });

  return rules.flatMap((rule) => {
    const report = rule.report;
    if (!report) return [];
    // author is a required section relation, always present.
    const recipients = report.sections.map((s) => ({
      userId: s.author.id,
      email: s.author.email,
      name: s.author.name,
      notificationOptOut: s.author.notificationOptOut,
    }));
    if (recipients.length === 0) return [];
    return [
      {
        id: rule.id,
        reportId: report.id,
        fireAt: rule.fireAt,
        reportPeriodLabel: formatPeriodLabel(
          report.periodStart,
          report.periodEnd,
        ),
        recipients,
      },
    ];
  });
}

export async function queryDueEscalationRules(
  prisma: PrismaService,
  now: Date,
  logger: UnresolvedGroupLogger,
): Promise<DueEscalationRule[]> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      status: "active",
      kind: "escalation",
      fireAt: { lte: now },
      reportId: { not: null },
      // Same guard as the deadline query: a cleared deadline silences the
      // period's rules at dispatch time, and an archived period is out of
      // scope — its rules stay `active` but must never dispatch again.
      report: { deadline: { not: null }, archived: false },
    },
    include: escalationRoutingInclude,
  });

  return rules.flatMap((rule) => {
    const report = rule.report;
    if (!report) return [];
    // The where-clause already excludes cleared deadlines; this re-check
    // narrows the type and covers a clear racing the query.
    if (report.deadline === null) return [];
    const { groups, unresolved } = buildEscalationGroups({
      ...report,
      deadline: report.deadline,
    });
    if (unresolved.length > 0) {
      logger.warn(
        `escalation: no active group head for ${unresolved.length} late lead(s) on report ${report.id}; digest skipped`,
      );
    }
    if (groups.length === 0) return [];
    return [
      {
        id: rule.id,
        reportId: report.id,
        fireAt: rule.fireAt,
        reportPeriodLabel: formatPeriodLabel(
          report.periodStart,
          report.periodEnd,
        ),
        groups,
      },
    ];
  });
}
