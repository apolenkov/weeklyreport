import {
  type AdminProject,
  type AdminReminderRule,
  type AdminUser,
  composeName,
  type ReportPeriod,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import { buildTransition } from "../period/index.js";
import {
  AdminUserConflictError,
  AdminUserReportingGroupRequiredError,
} from "./admin-shared.js";
import { resolveLifecycle } from "./snapshot-lifecycle.js";

// Single-entity writes only — never touch rows absent from the payload
// (closes concurrent-insert data loss from whole-snapshot reconcile).

// Viewers carry no group. Any other role must name one explicitly: a lead or
// head with no group is an incomplete admin write, not a reason to adopt the
// default group silently.
function resolveReportingGroupId(user: AdminUser): string | null {
  if (user.role === "viewer") return null;
  if (user.reportingGroupId === null || user.reportingGroupId === undefined) {
    throw new AdminUserReportingGroupRequiredError(
      "A reporting group is required for lead, head, and admin users.",
    );
  }
  return user.reportingGroupId;
}

export async function upsertUser(
  prisma: PrismaService,
  user: AdminUser,
): Promise<void> {
  const reportingGroupId = resolveReportingGroupId(user);
  // The denormalized display name is recomputed from the structured parts
  // server-side so the `name === composeName(parts)` invariant holds for every
  // admin client / imported row, not just the web form mapper.
  const name = composeName({
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
  });
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name,
        lastName: user.lastName,
        firstName: user.firstName,
        middleName: user.middleName,
        position: user.position,
        role: user.role,
        samlId: user.email,
        reportingGroupId,
      },
      update: {
        email: user.email,
        name,
        lastName: user.lastName,
        firstName: user.firstName,
        middleName: user.middleName,
        position: user.position,
        role: user.role,
        reportingGroupId,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw new AdminUserConflictError(
      "A user with this email or SAML identity already exists.",
    );
  }
}

export async function removeUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  // Only delete a user no section/project still references — otherwise the row
  // stays (the FK would block it anyway). A late-arriving reference that races
  // the count check surfaces as P2003 and is skipped, not surfaced as a 500.
  const hasReferences =
    (await prisma.reportSection.count({ where: { authorId: userId } })) > 0 ||
    (await prisma.project.count({ where: { leadId: userId } })) > 0;
  if (hasReferences) return;
  try {
    // deleteMany (not delete) so removing an already-absent id is a no-op
    // rather than a P2025 throw — matches the old reconcile, which never
    // failed on a missing row.
    await prisma.user.deleteMany({ where: { id: userId } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2003") return;
    throw error;
  }
}

// Session revocation is the caller's job.
export async function deactivateUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
}

// Session restoration is the caller's job.
export async function activateUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
}

export async function upsertProject(
  prisma: PrismaService,
  project: AdminProject,
): Promise<void> {
  await prisma.project.upsert({
    where: { id: project.id },
    create: {
      id: project.id,
      name: project.name,
      archived: project.archived,
      leadId: project.leadId,
    },
    update: {
      name: project.name,
      archived: project.archived,
      leadId: project.leadId,
    },
  });
}

export async function removeProject(
  prisma: PrismaService,
  projectId: string,
): Promise<void> {
  // Archive rather than delete: a project carries historical report content.
  await prisma.project.update({
    where: { id: projectId },
    data: { archived: true },
  });
}

export async function upsertReminderRule(
  prisma: PrismaService,
  rule: AdminReminderRule,
): Promise<void> {
  const ruleData = {
    kind: rule.kind,
    fireAt: rule.fireAt,
    timezone: rule.timezone,
    status: rule.status,
    version: rule.version,
    reportId: rule.reportId || null,
  };
  await prisma.reminderRule.upsert({
    where: { id: rule.id },
    create: { id: rule.id, ...ruleData },
    update: ruleData,
  });
}

export async function removeReminderRule(
  prisma: PrismaService,
  ruleId: string,
): Promise<void> {
  // deleteMany so a double-remove is idempotent rather than a P2025 throw.
  await prisma.reminderRule.deleteMany({ where: { id: ruleId } });
}

// Spreads resolveLifecycle so all three lifecycle machines restore verbatim;
// deriving one field from another corrupts divergent rows (reopened: status
// published + periodState open). Returns created so the post-commit applicator can run.
export async function writePeriodRow(
  client: Prisma.TransactionClient,
  period: ReportPeriod,
): Promise<{ created: boolean }> {
  const existing = await client.report.findUnique({
    where: { id: period.id },
    select: { id: true },
  });
  const lifecycle = buildTransition("restore", {
    lifecycle: resolveLifecycle(period),
  });
  const data = {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    deadline: period.deadline,
    ...lifecycle,
  };
  if (existing) {
    await client.report.update({ where: { id: period.id }, data });
    return { created: false };
  }
  await client.report.create({ data: { id: period.id, ...data } });
  return { created: true };
}
