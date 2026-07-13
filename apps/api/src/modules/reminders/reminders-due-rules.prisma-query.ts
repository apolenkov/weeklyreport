import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type {
  DueDeadlineRule,
  DueEscalationRule,
} from "./reminders.service.js";
import { buildEscalationGroups } from "./reminders-escalation-grouping.js";
import { formatPeriodLabel } from "./reminders-row-mappers.js";

/** Minimal logging surface `queryDueEscalationRules` needs — matches both NestJS `Logger` and `AppLogger`. */
export interface UnresolvedGroupLogger {
  warn(message: string): void;
}

/**
 * `findDueDeadlineRules` / `findDueEscalationRules` queries, split out of
 * `RemindersPrismaRepository` to keep that file under the line budget.
 */

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
    },
    include: {
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
    },
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
    },
    include: {
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
    },
  });

  return rules.flatMap((rule) => {
    const report = rule.report;
    if (!report) return [];
    const { groups, unresolved } = buildEscalationGroups(report);
    for (const leadName of unresolved) {
      logger.warn(
        `escalation: no active group head for late lead "${leadName}" on report ${report.id}; digest skipped`,
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
