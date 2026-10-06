import {
  type AdminProject,
  type AdminReportPeriod,
  type AdminUser,
  composeName,
  normalizeEmail,
} from "@customreport/shared";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import { reconcileProjectAssignment } from "../../lib/project-assignment.js";
import { lockUserAndAssertActivityAssignments } from "../../lib/user-activity-assignment.js";
import { buildTransition } from "../period/index.js";
import {
  AdminLastAdminError,
  AdminProjectNotFoundError,
  AdminUserConflictError,
  AdminUserNotFoundError,
  AdminUserPublishedHistoryError,
  AdminUserReportingGroupRequiredError,
} from "./admin-shared.js";
import { resolveLifecycle } from "./snapshot-lifecycle.js";

// Locks every active administrator, so two concurrent demotions serialize, and
// rejects the write when the target is the only one left.
async function assertNotLastActiveAdmin(
  tx: PrismaTypes.TransactionClient,
  userId: string,
): Promise<void> {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "role" = 'admin' AND "isActive" = true ORDER BY "id" FOR UPDATE
  `;
  if (admins.length === 1 && admins[0]?.id === userId) {
    throw new AdminLastAdminError(
      "This is the last active administrator. Make another user an active administrator first.",
    );
  }
}

// Single-entity writes only — never touch rows absent from the payload
// (closes concurrent-insert data loss from admin-recovery reconcile).

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
  // Live email identity is case-insensitive (the snapshot comparator and the
  // lower(email) unique index agree): writes persist the canonical form.
  // samlId stays the verbatim external identity — never case-folded.
  const email = normalizeEmail(user.email);
  try {
    await prisma.$transaction(async (tx) => {
      // Admin set first, then the user row: deactivate/delete take the same
      // order, so concurrent demotions cannot deadlock.
      if (user.role !== "admin") await assertNotLastActiveAdmin(tx, user.id);
      await lockUserAndAssertActivityAssignments(tx, {
        userId: user.id,
        role: user.role,
        reportingGroupId,
      });
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email,
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
          email,
          name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          position: user.position,
          role: user.role,
          reportingGroupId,
        },
      });
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
  const publishedReport = await prisma.report.findFirst({
    where: { publishedById: userId },
    select: { id: true },
  });
  if (publishedReport) {
    throw new AdminUserPublishedHistoryError(
      `User is retained by published report ${publishedReport.id}; deactivate the user instead.`,
    );
  }
  // A user still referenced by a section or project is an existing-resource
  // conflict, not a silent keep. A reference that commits after this count
  // races the delete and surfaces as P2003 below.
  const hasReferences =
    (await prisma.reportSection.count({ where: { authorId: userId } })) > 0 ||
    (await prisma.project.count({ where: { leadId: userId } })) > 0;
  if (hasReferences) {
    throw new AdminUserConflictError(
      "User is referenced by report sections or projects; deactivate the user instead.",
    );
  }
  try {
    // deleteMany makes removal idempotent: an already-absent id is a no-op
    // rather than a P2025 failure.
    await prisma.$transaction(async (tx) => {
      await assertNotLastActiveAdmin(tx, userId);
      await tx.user.deleteMany({ where: { id: userId } });
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2003") {
      // Close the check/delete race: a publication may have committed after
      // the first lookup while the restrictive FK rejected this delete.
      const racedPublication = await prisma.report.findFirst({
        where: { publishedById: userId },
        select: { id: true },
      });
      if (racedPublication) {
        throw new AdminUserPublishedHistoryError(
          `User is retained by published report ${racedPublication.id}; deactivate the user instead.`,
        );
      }
      // A reference committed between the count check and the delete — the
      // same conflict the precheck reports, surfaced by the restrictive FK.
      throw new AdminUserConflictError(
        "User is referenced by existing records; deactivate the user instead.",
      );
    }
    throw error;
  }
}

// Session revocation is the caller's job.
export async function deactivateUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await assertNotLastActiveAdmin(tx, userId);
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    });
  } catch (error: unknown) {
    // Only a missing row (P2025) becomes a typed NOT_FOUND; any other failure
    // propagates unchanged.
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2025") {
      throw new AdminUserNotFoundError(`User ${userId} was not found.`);
    }
    throw error;
  }
}

// Session restoration is the caller's job.
export async function activateUser(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2025") {
      throw new AdminUserNotFoundError(`User ${userId} was not found.`);
    }
    throw error;
  }
}

export async function upsertProject(
  prisma: PrismaService,
  project: AdminProject,
): Promise<void> {
  await prisma.$transaction((tx) => reconcileProjectAssignment(tx, project));
}

export async function removeProject(
  prisma: PrismaService,
  projectId: string,
): Promise<void> {
  // Archive rather than delete: a project carries historical report content.
  // Only a missing row (P2025) becomes a typed NOT_FOUND; any other failure
  // propagates unchanged.
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { archived: true },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2025") {
      throw new AdminProjectNotFoundError(
        `Project ${projectId} was not found.`,
      );
    }
    throw error;
  }
}

// Spreads resolveLifecycle so all three lifecycle machines restore verbatim;
// deriving one field from another corrupts divergent rows (reopened: status
// published + periodState open). Returns created so the post-commit applicator can run.
export async function writePeriodRow(
  client: PrismaTypes.TransactionClient,
  period: AdminReportPeriod,
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
    weekLabel: period.weekLabel,
    // Snapshot restore is intentionally a raw reinstatement of the
    // independently persisted publication document (not a lifecycle
    // transition). The admin schema has already validated its shape.
    publishedSnapshot:
      period.publishedSnapshot === null
        ? Prisma.DbNull
        : (JSON.parse(
            JSON.stringify(period.publishedSnapshot),
          ) as Prisma.InputJsonValue),
    ...lifecycle,
  };
  if (existing) {
    await client.report.update({ where: { id: period.id }, data });
    return { created: false };
  }
  await client.report.create({ data: { id: period.id, ...data } });
  return { created: true };
}
