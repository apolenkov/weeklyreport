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
import type { PolicyApplicatorService } from "../reminders/index.js";
import { ensureFallbackReportingGroup } from "./admin-group.queries";
import { AdminUserConflictError } from "./admin-shared.js";
import { resolveLifecycle } from "./snapshot-lifecycle.js";

/**
 * Targeted, single-entity admin write primitives: each mutates ONLY the named
 * row (upsert by id; delete/archive by id). They replace the whole-snapshot
 * destructive reconcile — a row absent from any payload is never touched, which
 * closes the concurrent-insert data-loss window an admin edit used to open.
 */

/**
 * Resolve a non-viewer user's reporting group: viewers carry none; everyone
 * else keeps their explicit group or falls back to the provisioned default
 * (the same rule the whole-snapshot user phase applies).
 */
async function resolveReportingGroupId(
  prisma: PrismaService,
  user: AdminUser,
): Promise<string | null> {
  if (user.role === "viewer") return null;
  return user.reportingGroupId ?? (await ensureFallbackReportingGroup(prisma));
}

export async function upsertUser(
  prisma: PrismaService,
  user: AdminUser,
): Promise<void> {
  const reportingGroupId = await resolveReportingGroupId(prisma, user);
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

/** Set `isActive=false`. Session revocation is the caller's job. */
export async function deactivateUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
}

/** Set `isActive=true`. Session restoration is the caller's job. */
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

/**
 * Create-or-update a single Report's envelope plus its governed lifecycle set,
 * returning whether a NEW row was created so the caller can run the
 * post-commit applicator. `resolveLifecycle` is spread (not hand-assembled) so
 * the three independently-persisted lifecycle machines are reinstated verbatim
 * — this is a non-transition restore write, not a lifecycle transition, and
 * deriving the coupled set from one field would corrupt a legitimately
 * divergent row (a reopened period is status="published" while
 * periodState="open"). The spread carries no literal governed key, so the
 * period-dual-state write gate passes without an exemption marker.
 */
export async function writePeriodRow(
  client: Prisma.TransactionClient,
  period: ReportPeriod,
): Promise<{ created: boolean }> {
  const existing = await client.report.findUnique({
    where: { id: period.id },
    select: { id: true },
  });
  const data = {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    deadline: period.deadline,
    ...resolveLifecycle(period),
  };
  if (existing) {
    await client.report.update({ where: { id: period.id }, data });
    return { created: false };
  }
  await client.report.create({ data: { id: period.id, ...data } });
  return { created: true };
}

export async function upsertPeriod(
  prisma: PrismaService,
  policyApplicator: PolicyApplicatorService | undefined,
  period: ReportPeriod,
): Promise<void> {
  const writeInTransaction = () =>
    prisma.$transaction((tx) => writePeriodRow(tx, period));
  const { created } = await writeInTransaction().catch(
    async (error: unknown) => {
      if (
        !isUniqueViolation(error, {
          index: "Report_pkey",
          columns: ["id"],
        })
      ) {
        throw error;
      }
      return writeInTransaction();
    },
  );
  // A newly-created period materializes one ReminderRule per active policy.
  // Runs AFTER the write commits (an applicator failure must not roll the
  // period back) — mirrors the whole-snapshot restore's post-commit step.
  if (created && policyApplicator) {
    await policyApplicator.applyToPeriod({
      id: period.id,
      deadline: period.deadline,
    });
  }
}
