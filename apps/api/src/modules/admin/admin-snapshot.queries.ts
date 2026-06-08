import {
  adminProjectSchema,
  adminReminderExecutionSchema,
  adminReminderRuleSchema,
  type AdminSnapshot,
  adminSnapshotSchema,
  adminUserSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  reportPeriodSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { audienceFromPrisma } from "./admin-enum-mappers";

/**
 * AdminSnapshot read path, extracted from `admin.prisma-repository.ts`
 * (R3a-4 max-lines split). The write path lives in
 * `admin-snapshot-write.queries.ts` (kept separate to stay under the size
 * budget).
 */

/**
 * Extracts recipientEmail from dedupeKey format: "ruleId:isoDate:email".
 */
function extractRecipientEmail(dedupeKey: string): string {
  const emailMatch = /Z:(.+)$/.exec(dedupeKey);
  return emailMatch?.[1] ?? "";
}

export async function getSnapshot(
  prisma: PrismaService,
): Promise<AdminSnapshot> {
  const [
    groups,
    users,
    projects,
    periods,
    reminderRules,
    reminderExecutions,
    reminderPolicies,
  ] = await Promise.all([
    prisma.reportingGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      include: { reportingGroup: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      include: { lead: true },
      orderBy: { name: "asc" },
    }),
    prisma.report.findMany({ orderBy: { periodStart: "desc" } }),
    prisma.reminderRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.reminderExecution.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.reminderPolicy.findMany({
      orderBy: [{ kind: "asc" }, { offsetMinutes: "asc" }],
    }),
  ]);

  return adminSnapshotSchema.parse({
    groups: groups.map((group) => reportingGroupSchema.parse(group)),
    users: users.map((u) =>
      adminUserSchema.parse({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        reportingGroupId: u.reportingGroupId ?? null,
        reportingGroupName: u.reportingGroup?.name ?? null,
        // A2 (UAT-v7 2026-05-12): surface the soft-deactivation flag.
        isActive: u.isActive,
      }),
    ),
    projects: projects.map((p) =>
      adminProjectSchema.parse({
        id: p.id,
        name: p.name,
        archived: p.archived,
        leadId: p.leadId,
        leadName: p.lead.name,
      }),
    ),
    periods: periods.map((r) =>
      reportPeriodSchema.parse({
        id: r.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        deadline: r.deadline,
        status: r.status,
        // fix-snapshot-lifecycle-restore: capture the complete governed
        // lifecycle set so restore can reinstate it verbatim. `findMany()`
        // above already returns every column — no query change.
        periodState: r.periodState,
        periodStatus: r.periodStatus,
        archived: r.archived,
        autoPublished: r.autoPublished,
        autoArchived: r.autoArchived,
        publishedAt: r.publishedAt,
        publishedById: r.publishedById,
        reopenedAt: r.reopenedAt,
      }),
    ),
    reminderRules: reminderRules.map((rule) =>
      adminReminderRuleSchema.parse({
        id: rule.id,
        reportId: rule.reportId,
        // UFB-036 (Phase 44-04): expose the policy FK so the admin
        // UI can group derived rules under their owning policy.
        policyId: rule.policyId,
        kind: rule.kind,
        fireAt: rule.fireAt,
        timezone: rule.timezone,
        status: rule.status,
        version: rule.version,
      }),
    ),
    reminderExecutions: reminderExecutions.map((exec) =>
      adminReminderExecutionSchema.parse({
        id: exec.id,
        ruleId: exec.ruleId,
        reportId: null,
        dedupeKey: exec.dedupeKey,
        status: exec.status === "pending" ? "queued" : exec.status,
        scheduledFor: exec.createdAt,
        sentAt: exec.sentAt,
        recipientEmail: extractRecipientEmail(exec.dedupeKey),
        errorMessage: exec.error,
      }),
    ),
    // UFB-036 (Phase 44-02): policies surfaced inline so the admin
    // snapshot fetch is one round trip on the wire.
    policies: reminderPolicies.map((row) =>
      reminderPolicySchema.parse({
        id: row.id,
        kind: row.kind,
        offsetMinutes: row.offsetMinutes,
        timezone: row.timezone,
        audience: audienceFromPrisma[row.audience],
        active: row.active,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
      }),
    ),
  });
}
