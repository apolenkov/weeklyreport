import type { Prisma, ReminderPolicy, ReminderRule } from "@prisma/client";
import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { DueDeadlineRule, DueEscalationRule } from "./reminders.types.js";
import { editableReminderReportWhere } from "./reminders-editable-report.prisma.js";
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
  policy: true,
  report: {
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      sections: {
        where: { status: "draft", author: { isActive: true } },
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
  policy: true,
  report: {
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      sections: {
        where: { status: "draft", author: { isActive: true } },
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

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function isCurrentPolicyRule(
  rule: Pick<
    ReminderRule,
    "deadline" | "fireAt" | "kind" | "status" | "timezone"
  >,
  policy: ReminderPolicy,
  reportDeadline: Date | null,
): reportDeadline is Date {
  if (
    reportDeadline === null ||
    rule.status !== "active" ||
    !sameInstant(rule.deadline, reportDeadline) ||
    rule.kind !== policy.kind ||
    rule.timezone !== policy.timezone ||
    !reminderPolicyAppliesTo(policy, reportDeadline)
  ) {
    return false;
  }
  return sameInstant(
    rule.fireAt,
    computeReminderFireAt(reportDeadline, policy.offsetMinutes),
  );
}

export async function queryDueDeadlineRules(
  prisma: PrismaService,
  now: Date,
): Promise<DueDeadlineRule[]> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      status: "active",
      kind: "deadline",
      policy: { active: true },
      fireAt: { lte: now },
      // Cleared deadlines remove the reminder reference point; archived periods
      // and every non-editable lifecycle tuple are outside automation scope.
      report: editableReminderReportWhere,
    },
    include: deadlineRecipientsInclude,
  });

  return rules.flatMap((rule) => {
    const report = rule.report;
    if (!isCurrentPolicyRule(rule, rule.policy, report.deadline)) return [];
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
        deadline: rule.deadline,
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
      policy: { active: true },
      fireAt: { lte: now },
      // Same guard as the deadline query: a cleared deadline silences the
      // period's rules, and only a coherent editable lifecycle may dispatch.
      report: editableReminderReportWhere,
    },
    include: escalationRoutingInclude,
  });

  return rules.flatMap((rule) => {
    const report = rule.report;
    // Validate the loaded deadline and rule identity against the current policy.
    if (!isCurrentPolicyRule(rule, rule.policy, report.deadline)) return [];
    const { groups, unresolved } = buildEscalationGroups({
      ...report,
      deadline: rule.deadline,
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
