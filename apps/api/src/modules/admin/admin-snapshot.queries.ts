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
import { extractRecipientEmail } from "../reminders/index.js";
import { audienceFromPrisma } from "./admin-enum-mappers";

async function fetchSnapshotRows(prisma: PrismaService) {
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

  return {
    groups,
    users,
    projects,
    periods,
    reminderRules,
    reminderExecutions,
    reminderPolicies,
  };
}

type SnapshotRows = Awaited<ReturnType<typeof fetchSnapshotRows>>;

function toAdminUser(u: SnapshotRows["users"][number]) {
  return adminUserSchema.parse({
    id: u.id,
    email: u.email,
    name: u.name,
    lastName: u.lastName,
    firstName: u.firstName,
    middleName: u.middleName,
    position: u.position,
    role: u.role,
    reportingGroupId: u.reportingGroupId ?? null,
    reportingGroupName: u.reportingGroup?.name ?? null,
    isActive: u.isActive,
  });
}

function toAdminProject(p: SnapshotRows["projects"][number]) {
  return adminProjectSchema.parse({
    id: p.id,
    name: p.name,
    archived: p.archived,
    leadId: p.leadId,
    leadName: p.lead.name,
  });
}

function toReportPeriod(r: SnapshotRows["periods"][number]) {
  return reportPeriodSchema.parse({
    id: r.id,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    deadline: r.deadline,
    status: r.status,
    // Full governed lifecycle set so restore can reinstate it verbatim.
    periodState: r.periodState,
    periodStatus: r.periodStatus,
    archived: r.archived,
    autoPublished: r.autoPublished,
    autoArchived: r.autoArchived,
    publishedAt: r.publishedAt,
    publishedById: r.publishedById,
    reopenedAt: r.reopenedAt,
  });
}

function toReminderRule(rule: SnapshotRows["reminderRules"][number]) {
  return adminReminderRuleSchema.parse({
    id: rule.id,
    reportId: rule.reportId,
    // Policy FK so the UI can group derived rules under their owning policy.
    policyId: rule.policyId,
    kind: rule.kind,
    fireAt: rule.fireAt,
    timezone: rule.timezone,
    status: rule.status,
    version: rule.version,
  });
}

// Executions don't store reportId or a separate schedule instant; the admin
// snapshot flattens to null reportId and uses createdAt as scheduledFor so the
// wire shape stays stable for the UI.
function toReminderExecution(exec: SnapshotRows["reminderExecutions"][number]) {
  return adminReminderExecutionSchema.parse({
    id: exec.id,
    ruleId: exec.ruleId,
    reportId: null,
    dedupeKey: exec.dedupeKey,
    status: exec.status === "pending" ? "queued" : exec.status,
    scheduledFor: exec.createdAt,
    sentAt: exec.sentAt,
    recipientEmail: extractRecipientEmail(exec.dedupeKey),
    errorMessage: exec.error,
  });
}

function toReminderPolicy(row: SnapshotRows["reminderPolicies"][number]) {
  return reminderPolicySchema.parse({
    id: row.id,
    kind: row.kind,
    offsetMinutes: row.offsetMinutes,
    timezone: row.timezone,
    audience: audienceFromPrisma[row.audience],
    active: row.active,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  });
}

export async function getSnapshot(
  prisma: PrismaService,
): Promise<AdminSnapshot> {
  const rows = await fetchSnapshotRows(prisma);

  return adminSnapshotSchema.parse({
    groups: rows.groups.map((group) => reportingGroupSchema.parse(group)),
    users: rows.users.map((user) => toAdminUser(user)),
    projects: rows.projects.map((project) => toAdminProject(project)),
    periods: rows.periods.map((period) => toReportPeriod(period)),
    reminderRules: rows.reminderRules.map((rule) => toReminderRule(rule)),
    reminderExecutions: rows.reminderExecutions.map((execution) =>
      toReminderExecution(execution),
    ),
    // Inline policies keep the snapshot fetch one round trip.
    policies: rows.reminderPolicies.map((policy) => toReminderPolicy(policy)),
  });
}
