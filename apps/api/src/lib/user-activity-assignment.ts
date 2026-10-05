import type { Prisma } from "@prisma/client";

// Product already belongs to a different reporting group → CONFLICT; the
// message names the current owner so the admin can detach first.
export class AdminGroupProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGroupProductConflictError";
  }
}

// A lead's activity attachments are live ownership edges. Changing the user's
// role or reporting group underneath them would create an invalid assignment.
export class AdminUserActivityAssignmentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserActivityAssignmentConflictError";
  }
}

/**
 * Locks a user before inspecting activity edges and rejects an incompatible
 * role/group change. Project-activity attachment uses this same first lock,
 * so assignment writes cannot race an attachment into a cross-group edge.
 */
export async function lockUserAndAssertActivityAssignments(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    role: string;
    reportingGroupId: string | null;
  },
): Promise<boolean> {
  const exists = await lockUser(tx, input.userId);
  if (!exists) return false;

  const edges = await tx.projectActivityLead.findMany({
    where: { leadId: input.userId },
    select: { activityId: true, activity: { select: { groupId: true } } },
    orderBy: { activityId: "asc" },
  });
  const incompatibleActivity = edges.find(
    (edge) =>
      input.role !== "lead" || edge.activity.groupId !== input.reportingGroupId,
  );
  if (incompatibleActivity) {
    throw new AdminUserActivityAssignmentConflictError(
      `User ${input.userId} has activity assignment ${incompatibleActivity.activityId}; detach it before changing role or reporting group.`,
    );
  }
  const projects = await tx.project.findMany({
    where: { leadId: input.userId },
    select: { id: true, groupProducts: { select: { groupId: true } } },
    orderBy: { id: "asc" },
  });
  const incompatibleProject = projects.find(
    (project) =>
      input.role !== "lead" ||
      project.groupProducts.some(
        ({ groupId }) => groupId !== input.reportingGroupId,
      ),
  );
  if (incompatibleProject) {
    throw new AdminUserActivityAssignmentConflictError(
      `User ${input.userId} owns project ${incompatibleProject.id}; detach or move the project before changing role or reporting group.`,
    );
  }
  const headedGroups = await tx.reportingGroup.findMany({
    where: { headUserId: input.userId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const headedGroup = headedGroups[0];
  if (
    headedGroup !== undefined &&
    input.role !== "head" &&
    input.role !== "admin"
  ) {
    throw new AdminUserActivityAssignmentConflictError(
      `User ${input.userId} heads reporting group ${headedGroup.id}; assign the head or admin role before changing it.`,
    );
  }
  return true;
}

/**
 * Locks the user row without blocking a parent-first section provision.
 *
 * `ensureLeadSection` locks Report before inserting rows that reference User.
 * PostgreSQL's foreign-key check takes a KEY SHARE lock on that User row. A
 * FOR UPDATE lock here would therefore deadlock with the assignment path's
 * user-first ordering. NO KEY UPDATE still excludes concurrent writes that
 * could change the user's key, while remaining compatible with the FK check;
 * all callers re-read the identity and assignment graph before mutating it.
 */
export async function lockUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const users = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE
  `;
  return users.length > 0;
}

/** Group writes use the same user-first lock as user writes. */
export async function lockAndAssertGroupHead(
  tx: Prisma.TransactionClient,
  headUserId: string | null | undefined,
): Promise<void> {
  if (!headUserId) return;
  const exists = await lockUser(tx, headUserId);
  if (!exists) {
    throw new AdminUserActivityAssignmentConflictError(
      `Head user ${headUserId} was not found. Refresh and retry.`,
    );
  }
  const user = await tx.user.findUnique({
    where: { id: headUserId },
    select: { role: true },
  });
  if (user?.role !== "head" && user?.role !== "admin") {
    throw new AdminUserActivityAssignmentConflictError(
      `User ${headUserId} must have the head or admin role to head a reporting group.`,
    );
  }
}

/** Locks the current and desired project leads in one stable order. */
async function lockProjectOwnershipUsers(
  tx: Prisma.TransactionClient,
  projectId: string,
  desiredLeadId: string,
): Promise<{ leadId: string } | null> {
  const before = await tx.project.findUnique({
    where: { id: projectId },
    select: { leadId: true },
  });
  const userIds = [
    ...new Set(
      [before?.leadId, desiredLeadId].filter(
        (id): id is string => id !== undefined,
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  for (const userId of userIds) await lockUser(tx, userId);
  return before;
}

/**
 * Locks the users participating in a project ownership write in one stable
 * order, then reads the project and its ownership edge again. Every project
 * and GroupProduct writer uses this boundary before mutating either row.
 */
export async function lockAndValidateProjectOwnership(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    desiredLeadId: string;
    expectedGroupId?: string;
    requireDesiredLeadCurrent?: boolean;
  },
): Promise<{
  project: {
    leadId: string;
    lead: { role: string; reportingGroupId: string | null };
  } | null;
  ownership: {
    id: string;
    productId: string;
    groupId: string;
    createdAt: Date;
  } | null;
}> {
  const before = await lockProjectOwnershipUsers(
    tx,
    input.projectId,
    input.desiredLeadId,
  );
  const project = await tx.project.findUnique({
    where: { id: input.projectId },
    select: {
      leadId: true,
      lead: { select: { role: true, reportingGroupId: true } },
    },
  });
  if (project && before && project.leadId !== before.leadId) {
    throw new AdminGroupProductConflictError(
      `Project ${input.projectId} changed ownership concurrently. Refresh and retry.`,
    );
  }
  if (
    input.requireDesiredLeadCurrent &&
    project?.leadId !== input.desiredLeadId
  ) {
    throw new AdminGroupProductConflictError(
      `Project ${input.projectId} changed ownership concurrently. Refresh and retry.`,
    );
  }
  const desiredLead = await tx.user.findUnique({
    where: { id: input.desiredLeadId },
    select: { role: true, reportingGroupId: true },
  });
  if (desiredLead?.role !== "lead") {
    throw new AdminGroupProductConflictError(
      `Project ${input.projectId} must be owned by an active lead user.`,
    );
  }
  const ownership = await tx.groupProduct.findUnique({
    where: { productId: input.projectId },
    select: { id: true, productId: true, groupId: true, createdAt: true },
  });
  if (
    ownership &&
    project &&
    (project.lead.role !== "lead" ||
      project.lead.reportingGroupId !== ownership.groupId ||
      desiredLead.reportingGroupId !== ownership.groupId)
  ) {
    throw new AdminGroupProductConflictError(
      `Project ${input.projectId} lead and product group ownership do not match.`,
    );
  }
  if (
    input.expectedGroupId &&
    !ownership &&
    desiredLead.reportingGroupId !== input.expectedGroupId
  ) {
    throw new AdminGroupProductConflictError(
      `Project ${input.projectId} is owned by another reporting group.`,
    );
  }
  return { project, ownership };
}
