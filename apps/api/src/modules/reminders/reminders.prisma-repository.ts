import {
  type AdminReminderExecution,
  type AdminReminderRule,
} from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type DueDeadlineRule,
  type DueEscalationRule,
  type RemindersRepository,
} from "./reminders.service.js";
import { buildEscalationGroups } from "./reminders-escalation-grouping.js";
import {
  formatPeriodLabel,
  isDedupeKeyConflict,
  toExecutionCreateData,
  toExecutionDomain,
  toExecutionUpdateData,
  toRuleDomain,
} from "./reminders-row-mappers.js";

@Injectable()
export class RemindersPrismaRepository implements RemindersRepository {
  private readonly logger = new Logger(RemindersPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns active deadline rules whose fireAt is in the past,
   * pre-resolved with the recipient leads (those whose ReportSection for
   * the rule's reportId is still 'draft' status). Rules without a reportId
   * are skipped — they have no concrete deadline to remind about.
   */
  async findDueDeadlineRules(now: Date): Promise<DueDeadlineRule[]> {
    const rules = await this.prisma.reminderRule.findMany({
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
  async findDueEscalationRules(now: Date): Promise<DueEscalationRule[]> {
    const rules = await this.prisma.reminderRule.findMany({
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
        this.logger.warn(
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

  async getRule(ruleId: string): Promise<AdminReminderRule | null> {
    const rule = await this.prisma.reminderRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return null;
    }

    return toRuleDomain(rule);
  }

  async findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null> {
    const execution = await this.prisma.reminderExecution.findUnique({
      where: { dedupeKey },
      include: { rule: true },
    });
    return execution ? toExecutionDomain(execution) : null;
  }

  async saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution> {
    const saved = await this.prisma.reminderExecution.upsert({
      where: { dedupeKey: execution.dedupeKey },
      create: toExecutionCreateData(execution),
      update: toExecutionUpdateData(execution),
      include: { rule: true },
    });

    return toExecutionDomain(saved);
  }

  async insertExecutionOnConflict(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
    try {
      const created = await this.prisma.reminderExecution.create({
        data: toExecutionCreateData(execution),
        include: { rule: true },
      });
      return { execution: toExecutionDomain(created), inserted: true };
    } catch (error: unknown) {
      // A concurrent tick won the dedupeKey insert: re-read its committed row
      // and report `inserted: false` so the caller enqueues nothing. The losing
      // INSERT blocks until the winner commits, so the re-read always sees it.
      // Any other failure re-throws.
      if (!isDedupeKeyConflict(error)) throw error;
      const existing = await this.findExecutionByDedupeKey(execution.dedupeKey);
      if (!existing) throw error;
      return { execution: existing, inserted: false };
    }
  }

  /**
   * Atomic `queued → sending` claim. The predicate lives in the write's WHERE,
   * so two racing workers cannot both move the same row: exactly one `updateMany`
   * matches `status: "pending"` and returns count 1; the loser returns 0.
   */
  async transitionExecutionToSending(executionId: string): Promise<boolean> {
    const result = await this.prisma.reminderExecution.updateMany({
      where: { id: executionId, status: "pending" },
      data: { status: "sending" },
    });
    return result.count > 0;
  }

  /**
   * Reverses the claim above (`sending → pending`) so a retryable dispatch
   * failure can be re-claimed by the next BullMQ attempt. Guarded to
   * `sending` in the write, so it is a no-op against a row that is already
   * `sent`/`failed` under a concurrent caller.
   */
  async releaseExecutionClaim(executionId: string): Promise<void> {
    await this.prisma.reminderExecution.updateMany({
      where: { id: executionId, status: "sending" },
      data: { status: "pending" },
    });
  }

  /**
   * Terminal `failed` write. Guarded to the non-terminal states so it never
   * clobbers a row that already reached `sent` (a late enqueue-error write
   * arriving after a concurrent successful send stays a no-op).
   */
  async markExecutionFailed(
    executionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.reminderExecution.updateMany({
      where: { id: executionId, status: { in: ["pending", "sending"] } },
      data: { status: "failed", error: errorMessage },
    });
  }

  /**
   * Executions still `queued` (Prisma `pending`) whose row is older than
   * `olderThan` — the pod-died-before-enqueue case that leaves no job and no
   * `failed` marker. `sending` rows are intentionally excluded: re-enqueuing an
   * in-flight send would risk a duplicate.
   */
  async listStuckQueuedExecutions(
    olderThan: Date,
  ): Promise<AdminReminderExecution[]> {
    const executions = await this.prisma.reminderExecution.findMany({
      where: { status: "pending", createdAt: { lt: olderThan } },
      include: { rule: true },
      orderBy: [{ createdAt: "asc" }],
      take: 100,
    });
    return executions.map(toExecutionDomain);
  }

  async getExecution(
    executionId: string,
  ): Promise<AdminReminderExecution | null> {
    const execution = await this.prisma.reminderExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });

    if (!execution) {
      return null;
    }

    return toExecutionDomain(execution);
  }

  async listExecutions(ruleId: string): Promise<AdminReminderExecution[]> {
    // Explicit LIMIT 100 on the admin "executions" listing. Without it Prisma
    // issues `... ORDER BY createdAt DESC OFFSET $1`
    // with no upper bound, which a) trips the slow-query log on growing
    // tables and b) loads more rows into memory than the UI ever paginates
    // through (admin reminder page caps at 20 per page; 100 covers ~5 pages
    // of cursor-based scroll). The router still applies cursor pagination
    // on top of this slice via RemindersService.listExecutions.
    const executions = await this.prisma.reminderExecution.findMany({
      where: { ruleId },
      include: { rule: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });

    return executions.map(toExecutionDomain);
  }
}
