import { Prisma } from "@prisma/client";
import type { AdminSnapshot } from "@weeklyreport/shared";

import { lockUser } from "../../../lib/user-activity-assignment.js";
import { AdminSnapshotConflictError } from "../admin-errors.js";

interface AssignmentGraph {
  user: { id: string; role: string; reportingGroupId: string | null };
  group: { id: string; headUserId: string | null };
  project: { id: string; leadId: string; ownershipGroupId: string | null };
}

interface AssignmentRows {
  users: Map<string, AssignmentGraph["user"]>;
  groups: Map<string, AssignmentGraph["group"]>;
  projects: Map<string, AssignmentGraph["project"]>;
  activities: readonly { leadId: string; activity: { groupId: string } }[];
  previousLeadByProject: Map<string, string>;
}

async function lockExistingAssignmentRows(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const [userIds, groupIds, projectIds] = await Promise.all([
    tx.user.findMany({ select: { id: true } }),
    tx.reportingGroup.findMany({ select: { id: true } }),
    tx.project.findMany({ select: { id: true } }),
  ]);
  const orderedUserIds = [...userIds].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const orderedGroupIds = [...groupIds].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const orderedProjectIds = [...projectIds].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  for (const { id } of orderedUserIds) {
    await lockUser(tx, id);
  }
  for (const { id } of orderedGroupIds) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "ReportingGroup" WHERE "id" = ${id} FOR UPDATE
    `);
  }
  for (const { id } of orderedProjectIds) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Project" WHERE "id" = ${id} FOR NO KEY UPDATE
    `);
  }
}

async function readAssignmentRows(
  tx: Prisma.TransactionClient,
): Promise<AssignmentRows> {
  const [currentUsers, currentGroups, currentProjects, activities] =
    await Promise.all([
      tx.user.findMany({
        select: { id: true, role: true, reportingGroupId: true },
      }),
      tx.reportingGroup.findMany({ select: { id: true, headUserId: true } }),
      tx.project.findMany({
        select: {
          id: true,
          leadId: true,
          groupProducts: { select: { groupId: true } },
        },
      }),
      tx.projectActivityLead.findMany({
        select: { leadId: true, activity: { select: { groupId: true } } },
      }),
    ]);
  return {
    users: new Map(currentUsers.map((user) => [user.id, user])),
    groups: new Map(currentGroups.map((group) => [group.id, group])),
    projects: new Map(
      currentProjects.map((project) => [
        project.id,
        {
          id: project.id,
          leadId: project.leadId,
          ownershipGroupId: project.groupProducts[0]?.groupId ?? null,
        },
      ]),
    ),
    activities,
    previousLeadByProject: new Map(
      currentProjects.map((project) => [project.id, project.leadId]),
    ),
  };
}

function applySnapshotAssignments(
  rows: AssignmentRows,
  snapshot: AdminSnapshot,
): void {
  for (const user of snapshot.users) {
    rows.users.set(user.id, {
      id: user.id,
      role: user.role,
      reportingGroupId: user.reportingGroupId ?? null,
    });
  }
  for (const group of snapshot.groups) {
    rows.groups.set(group.id, {
      id: group.id,
      headUserId: group.headUserId ?? null,
    });
  }
  for (const project of snapshot.projects) {
    rows.projects.set(project.id, {
      id: project.id,
      leadId: project.leadId,
      ownershipGroupId: rows.projects.get(project.id)?.ownershipGroupId ?? null,
    });
  }
}

function assertGroupHeads(rows: AssignmentRows): void {
  for (const group of rows.groups.values()) {
    const head = group.headUserId
      ? rows.users.get(group.headUserId)
      : undefined;
    if (
      head?.role === "admin" ||
      (head?.role === "head" && head.reportingGroupId === group.id)
    )
      continue;
    if (!group.headUserId) continue;
    throw new AdminSnapshotConflictError(
      `Snapshot group ${group.id} has an ineligible final head assignment.`,
    );
  }
}

function assertActivityLeads(rows: AssignmentRows): void {
  for (const activity of rows.activities) {
    const lead = rows.users.get(activity.leadId);
    if (
      lead?.role === "lead" &&
      lead.reportingGroupId === activity.activity.groupId
    )
      continue;
    throw new AdminSnapshotConflictError(
      `Snapshot final graph leaves activity lead ${activity.leadId} outside its group.`,
    );
  }
}

function assertProjectLeads(rows: AssignmentRows): void {
  for (const project of rows.projects.values()) {
    const lead = rows.users.get(project.leadId);
    const validOwnership =
      project.ownershipGroupId === null ||
      lead?.reportingGroupId === project.ownershipGroupId;
    if (lead?.role === "lead" && validOwnership) continue;
    throw new AdminSnapshotConflictError(
      `Snapshot project ${project.id} has an invalid final lead ownership graph.`,
    );
  }
}

/** Locks and validates the final assignment graph before restore writes. */
export async function lockAndValidateSnapshotAssignmentGraph(
  tx: Prisma.TransactionClient,
  snapshot: AdminSnapshot,
): Promise<ReadonlyMap<string, string>> {
  await lockExistingAssignmentRows(tx);
  const rows = await readAssignmentRows(tx);
  applySnapshotAssignments(rows, snapshot);
  assertGroupHeads(rows);
  assertActivityLeads(rows);
  assertProjectLeads(rows);
  return rows.previousLeadByProject;
}
