import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { DueDeadlineRule, DueEscalationRule } from "./reminders.types.js";
import { buildEscalationGroups } from "./reminders-escalation-grouping.js";
import { formatPeriodLabel } from "./reminders-row-mappers.js";

/** Minimal logging surface `queryDueEscalationRules` needs — matches both NestJS `Logger` and `AppLogger`. */
export interface UnresolvedGroupLogger {
  warn(message: string): void;
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

/**
 * Returns active deadline rules whose fireAt is in the past,
 * pre-resolved with the recipient leads (those whose ReportSection for
 * the rule's reportId is still 'draft' status). Rules without a reportId
 * are skipped — they have no concrete deadline to remind about.
 */
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
      // An admin can clear a period's deadline AFTER rules materialized; such
      // rules must never dispatch — reminders are deadline-relative and the
      // reference point is gone.
      report: { deadline: { not: null } },
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

/**
 * Active escalation rules whose fireAt has passed, fanned out per reporting-
 * group head. Each late lead (a section still in `draft` for the rule's
 * report at T+2h) is routed to its group's active head (role head/admin,
 * `isActive`); leads whose group has no resolvable active head are logged and
 * dropped. Resolution is independent of `Report.publishedBy` — escalation
 * fires while leads are still in `draft`, before any publish.
 */
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
      // period's rules at dispatch time.
      report: { deadline: { not: null } },
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
