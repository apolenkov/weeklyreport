import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  adminReminderRuleSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { RemindersRepository } from "./reminders.service.js";

const execStatusToDb: Record<string, string> = {
  queued: "pending",
  sent: "sent",
  failed: "failed",
};

const dbExecStatusToDomain: Record<string, AdminReminderExecution["status"]> = {
  pending: "queued",
  sent: "sent",
  failed: "failed",
};

/**
 * NOTIF-04 (Phase 28-03), NOTIF-05 (Phase 29-05): row shape for the hourly
 * @Cron tick.
 *
 * Each due rule resolves to one or more recipients — leads whose section is
 * still in 'draft' status for the rule's reportId. The scheduler iterates
 * recipients and calls `requestReminderExecution` with the kind='deadline'
 * payload. Idempotent dedupe by `${rule.id}:deadline:${cycleDate}:${email}`
 * collapses two ticks within a single UTC day into exactly one email.
 *
 * `notificationOptOut` flows through from `User.notificationOptOut` so the
 * scheduler can skip leads who have opted out — escalation digests do NOT
 * read this flag.
 */
export interface DueDeadlineRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  recipients: {
    userId: string;
    email: string;
    name: string;
    notificationOptOut: boolean;
  }[];
}

/**
 * NOTIF-02 (Phase 29-05): row shape for the T+2h escalation tick.
 *
 * One due escalation rule maps to ONE digest email per (rule, head). The
 * digest body aggregates ALL late leads for the rule's reportId — the head
 * never receives one email per lead.
 */
export interface DueEscalationRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  head: { userId: string; email: string; name: string };
  lateLeads: {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
}

@Injectable()
export class RemindersPrismaRepository implements RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * NOTIF-04: returns active deadline rules whose fireAt is in the past,
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

    const due: DueDeadlineRule[] = [];
    for (const rule of rules) {
      if (!rule.report) continue;
      const recipients = rule.report.sections.flatMap((s) => {
        // (s.author is a required relation, always present.)
        return [
          {
            userId: s.author.id,
            email: s.author.email,
            name: s.author.name,
            notificationOptOut: s.author.notificationOptOut,
          },
        ];
      });
      if (recipients.length === 0) continue;
      due.push({
        id: rule.id,
        reportId: rule.report.id,
        fireAt: rule.fireAt,
        reportPeriodLabel: formatPeriodLabel(
          rule.report.periodStart,
          rule.report.periodEnd,
        ),
        recipients,
      });
    }
    return due;
  }

  /**
   * NOTIF-02 (Phase 29-05): returns active escalation rules whose fireAt is
   * in the past, pre-resolved with the recipient head + the aggregated late
   * leads (those whose ReportSection for the rule's reportId is still in
   * 'draft' at T+2h). One row per (rule, head); the digest body is built by
   * the scheduler from the `lateLeads` array.
   *
   * The head is resolved as the most recent publisher of the report; if no
   * publisher exists yet, the rule is skipped (no escalation target).
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
            publishedBy: {
              select: { id: true, email: true, name: true },
            },
            sections: {
              where: { status: "draft" },
              select: {
                author: {
                  select: { id: true, email: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    const due: DueEscalationRule[] = [];
    for (const rule of rules) {
      if (!rule.report) continue;
      const report = rule.report;
      const head = report.publishedBy;
      if (!head) continue;
      const lateLeads = report.sections.flatMap((s) => {
        // (s.author is a required relation, always present.)
        return [
          {
            leadName: s.author.name,
            sectionTitle: `Report ${report.id} section`,
            deadlineIso: report.deadline.toISOString(),
          },
        ];
      });
      if (lateLeads.length === 0) continue;
      due.push({
        id: rule.id,
        reportId: rule.report.id,
        fireAt: rule.fireAt,
        reportPeriodLabel: formatPeriodLabel(
          rule.report.periodStart,
          rule.report.periodEnd,
        ),
        head: { userId: head.id, email: head.email, name: head.name },
        lateLeads,
      });
    }
    return due;
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

    if (!execution) {
      return null;
    }

    return toExecutionDomain(execution);
  }

  async saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution> {
    const saved = await this.prisma.reminderExecution.upsert({
      where: { dedupeKey: execution.dedupeKey },
      create: {
        id: execution.id,
        ruleId: execution.ruleId,
        dedupeKey: execution.dedupeKey,
        status: (execStatusToDb[execution.status] ?? "pending") as "pending",
        sentAt: execution.sentAt,
        error: execution.errorMessage,
      },
      update: {
        status: (execStatusToDb[execution.status] ?? "pending") as "pending",
        sentAt: execution.sentAt,
        error: execution.errorMessage,
      },
      include: { rule: true },
    });

    return toExecutionDomain(saved);
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
    // FIX-03 (Phase 35-08): explicit LIMIT 100 on the admin "executions"
    // listing. Without it Prisma issues `... ORDER BY createdAt DESC OFFSET $1`
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

function formatPeriodLabel(start: Date, end: Date): string {
  // Compact UTC-formatted label, e.g. "2026-04-13 → 2026-04-19"
  return `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
}

function toRuleDomain(rule: {
  id: string;
  kind: string;
  fireAt: Date;
  timezone: string;
  status: string;
  version: number;
  reportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminReminderRule {
  return adminReminderRuleSchema.parse({
    id: rule.id,
    reportId: rule.reportId,
    kind: rule.kind,
    fireAt: rule.fireAt,
    timezone: rule.timezone,
    status: rule.status,
    version: rule.version,
  });
}

/**
 * Extracts recipientEmail from dedupeKey. Two key shapes are in flight in v6.0:
 *
 *   Legacy (BUG-023, v2.0):     `${ruleId}:<ISO with Z>:${email}`
 *     example: `<uuid>:2026-04-12T10:00:00.000Z:user@example.com`
 *
 *   Phase 28+ (NOTIF-04/02):    `${ruleId}:${kind}:YYYY-MM-DD:${email}`
 *     example: `<uuid>:deadline:2026-04-12:user@example.com`
 *     example: `<uuid>:escalation:2026-04-12:head@example.com`
 *
 * Phase 32-C / H-02: the legacy regex `/Z:(.+)$/` returned '' for every Phase
 * 28+ key (no `Z:`), silently breaking AdminReminderExecution.recipientEmail.
 *
 * Strategy: split on ':' and take the LAST segment that matches an email
 * shape. Both shapes terminate with the email, so this is robust to either
 * layout. Returns '' for unparseable inputs.
 */
// eslint-disable-next-line sonarjs/super-linear-regex -- negated character classes are linear; no catastrophic backtracking, input bounded to ~254 chars
const EMAIL_RE = /^[^@\s:]+@[^@\s:]+\.[^@\s:]+$/;
export function extractRecipientEmail(dedupeKey: string): string {
  const last = dedupeKey.split(":").pop();
  if (last && EMAIL_RE.test(last)) return last;
  return "";
}

function toExecutionDomain(execution: {
  id: string;
  ruleId: string;
  dedupeKey: string;
  status: string;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  rule: { reportId: string | null };
}): AdminReminderExecution {
  return adminReminderExecutionSchema.parse({
    id: execution.id,
    ruleId: execution.ruleId,
    reportId: execution.rule.reportId,
    dedupeKey: execution.dedupeKey,
    status: dbExecStatusToDomain[execution.status] ?? "queued",
    scheduledFor: execution.createdAt,
    sentAt: execution.sentAt,
    recipientEmail: extractRecipientEmail(execution.dedupeKey),
    errorMessage: execution.error,
  });
}
