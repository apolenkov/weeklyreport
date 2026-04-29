import { Injectable } from '@nestjs/common';
import {
  adminReminderRuleSchema,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  type AdminReminderExecution,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { RemindersRepository } from './reminders.service.js';

const execStatusToDb: Record<string, string> = {
  queued: 'pending',
  sent: 'sent',
  failed: 'failed',
};

const dbExecStatusToDomain: Record<string, AdminReminderExecution['status']> = {
  pending: 'queued',
  sent: 'sent',
  failed: 'failed',
};

/**
 * NOTIF-04 (Phase 28-03): row shape for the hourly @Cron tick.
 *
 * Each due rule resolves to one or more recipients — leads whose section is
 * still in 'draft' status for the rule's reportId. The scheduler iterates
 * recipients and calls `requestReminderExecution` with the kind='deadline'
 * payload. Idempotent dedupe by `${rule.id}:deadline:${cycleDate}:${email}`
 * collapses two ticks within a single UTC day into exactly one email.
 */
export interface DueDeadlineRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  recipients: Array<{ userId: string; email: string; name: string }>;
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
        status: 'active',
        kind: 'deadline',
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
              where: { status: 'draft' },
              select: {
                authorId: true,
                author: {
                  select: { id: true, email: true, name: true },
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
      const recipients = rule.report.sections
        .filter((s) => s.author !== null)
        .map((s) => ({
          userId: s.author!.id,
          email: s.author!.email,
          name: s.author!.name,
        }));
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

  async getRule(ruleId: string): Promise<AdminReminderRule | null> {
    const rule = await this.prisma.reminderRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return null;
    }

    return toRuleDomain(rule);
  }

  async findExecutionByDedupeKey(dedupeKey: string): Promise<AdminReminderExecution | null> {
    const execution = await this.prisma.reminderExecution.findUnique({
      where: { dedupeKey },
      include: { rule: true },
    });

    if (!execution) {
      return null;
    }

    return toExecutionDomain(execution);
  }

  async saveExecution(execution: AdminReminderExecution): Promise<AdminReminderExecution> {
    const saved = await this.prisma.reminderExecution.upsert({
      where: { dedupeKey: execution.dedupeKey },
      create: {
        id: execution.id,
        ruleId: execution.ruleId,
        dedupeKey: execution.dedupeKey,
        status: (execStatusToDb[execution.status] ?? 'pending') as 'pending',
        sentAt: execution.sentAt,
        error: execution.errorMessage,
      },
      update: {
        status: (execStatusToDb[execution.status] ?? 'pending') as 'pending',
        sentAt: execution.sentAt,
        error: execution.errorMessage,
      },
      include: { rule: true },
    });

    return toExecutionDomain(saved);
  }

  async getExecution(executionId: string): Promise<AdminReminderExecution | null> {
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
    const executions = await this.prisma.reminderExecution.findMany({
      where: { ruleId },
      include: { rule: true },
      orderBy: { createdAt: 'desc' },
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
 * Extracts recipientEmail from dedupeKey format: "ruleId:isoDate:email".
 * The dedupeKey includes recipientEmail for per-recipient uniqueness (BUG-023).
 */
function extractRecipientEmail(dedupeKey: string): string {
  // dedupeKey format: "ruleId:isoDate:recipientEmail"
  // The email is everything after the ISO date suffix "Z:"
  // Format: uuid:2026-04-12T10:00:00.000Z:user@example.com
  const emailMatch = dedupeKey.match(/Z:(.+)$/);
  return emailMatch?.[1] ?? '';
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
    status: dbExecStatusToDomain[execution.status] ?? 'queued',
    scheduledFor: execution.createdAt,
    sentAt: execution.sentAt,
    recipientEmail: extractRecipientEmail(execution.dedupeKey),
    errorMessage: execution.error,
  });
}
