import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  adminReminderRuleSchema,
} from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  buildEscalationGroups,
  type DueDeadlineRule,
  type DueEscalationRule,
  type RemindersRepository,
} from "./reminders.service.js";

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

/** Map a domain execution to the Prisma row written on create/insert. */
function toExecutionCreateData(
  execution: AdminReminderExecution,
): Prisma.ReminderExecutionUncheckedCreateInput {
  return {
    id: execution.id,
    ruleId: execution.ruleId,
    dedupeKey: execution.dedupeKey,
    status: (execStatusToDb[execution.status] ?? "pending") as "pending",
    sentAt: execution.sentAt,
    error: execution.errorMessage,
  };
}

@Injectable()
export class RemindersPrismaRepository implements RemindersRepository {
  private readonly logger = new Logger(RemindersPrismaRepository.name);

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
      update: {
        status: (execStatusToDb[execution.status] ?? "pending") as "pending",
        sentAt: execution.sentAt,
        error: execution.errorMessage,
      },
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

/**
 * True when `error` is the Prisma P2002 raised by the `dedupeKey` unique index
 * (`ReminderExecution_dedupeKey_key`). Under the pg driver adapter `meta.target`
 * is unset, so the index identity lives in `message` /
 * `meta.driverAdapterError.cause.originalMessage`; both — and the classic
 * engine's column-name form — contain the `dedupeKey` substring. Since the
 * caller only inserts a `ReminderExecution`, that substring uniquely
 * identifies this conflict; any other violation returns false (and re-throws).
 */
function isDedupeKeyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { driverAdapterError?: { cause?: { originalMessage?: unknown } } };
  };
  if (candidate.code !== "P2002") return false;
  const original = candidate.meta?.driverAdapterError?.cause?.originalMessage;
  const identity = `${typeof candidate.message === "string" ? candidate.message : ""} ${typeof original === "string" ? original : ""}`;
  return identity.includes("dedupeKey");
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
