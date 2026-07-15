import {
  type ReportingGroup,
  reportingGroupSchema,
  type StageAssignment,
  stageAssignmentSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";

/**
 * ReportingGroup + StageAssignment domain queries. `ensureFallbackReportingGroup`
 * is also consumed by the snapshot domain (saveSnapshot), so it is exported.
 */

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";
const DEFAULT_REPORTING_GROUP_NAME = "Core Development";

/**
 * Accepts the transaction client so it can run under `saveSnapshot`'s
 * `$transaction` (its `reportingGroup.upsert` must not commit ahead of a
 * later-phase failure). The full PrismaService is structurally assignable, so
 * the targeted per-entity callers can still pass `this.prisma` directly.
 */
export async function ensureFallbackReportingGroup(
  prisma: Prisma.TransactionClient,
): Promise<string> {
  const existing = await prisma.reportingGroup.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.reportingGroup.upsert({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    create: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: DEFAULT_REPORTING_GROUP_NAME,
      description: "Default reporting group for newly provisioned users",
      archived: false,
    },
    update: { archived: false },
    select: { id: true },
  });
  return created.id;
}

export async function saveReportingGroup(
  prisma: PrismaService,
  group: ReportingGroup,
): Promise<ReportingGroup> {
  const row = await prisma.reportingGroup.upsert({
    where: { id: group.id },
    create: {
      id: group.id,
      name: group.name,
      description: group.description ?? null,
      archived: group.archived,
      headUserId: group.headUserId ?? null,
    },
    update: {
      name: group.name,
      description: group.description ?? null,
      archived: group.archived,
      headUserId: group.headUserId ?? null,
    },
  });

  return reportingGroupSchema.parse(row);
}

export async function archiveReportingGroup(
  prisma: PrismaService,
  groupId: string,
): Promise<ReportingGroup> {
  const row = await prisma.reportingGroup.update({
    where: { id: groupId },
    data: { archived: true },
  });

  return reportingGroupSchema.parse(row);
}

interface StageAssignmentInput {
  readonly userId: string;
  readonly stageId: string;
  readonly projectId: string;
}

const STAGE_ASSIGNMENT_RELATIONS = {
  stage: { select: { name: true } },
  user: { select: { name: true } },
} satisfies Prisma.StageAssignmentInclude;

/**
 * Writes the assignment idempotently against the `stageId_projectId` unique
 * constraint. A reassign only ever changes the assignee, so `update` touches
 * `userId` only. Prisma's `upsert` on this secondary compound key is not a
 * native `INSERT ... ON CONFLICT`, so two concurrent first-assigns of the same
 * pair still race the constraint; the loser catches its own P2002 and resolves
 * to the update path rather than surfacing a raw 500.
 */
async function upsertStageAssignmentRow(
  prisma: PrismaService,
  data: StageAssignmentInput,
) {
  const where = {
    stageId_projectId: { stageId: data.stageId, projectId: data.projectId },
  };
  try {
    return await prisma.stageAssignment.upsert({
      where,
      create: data,
      update: { userId: data.userId },
      include: STAGE_ASSIGNMENT_RELATIONS,
    });
  } catch (error) {
    if (
      !isUniqueViolation(error, {
        index: "StageAssignment_stageId_projectId_key",
        columns: ["stageId", "projectId"],
      })
    ) {
      throw error;
    }
    return prisma.stageAssignment.update({
      where,
      data: { userId: data.userId },
      include: STAGE_ASSIGNMENT_RELATIONS,
    });
  }
}

export async function saveStageAssignment(
  prisma: PrismaService,
  data: StageAssignmentInput,
): Promise<StageAssignment> {
  const row = await upsertStageAssignmentRow(prisma, data);

  return stageAssignmentSchema.parse({
    id: row.id,
    userId: row.userId,
    stageId: row.stageId,
    projectId: row.projectId,
    stageName: row.stage.name,
    userName: row.user.name,
  });
}

export async function deleteStageAssignment(
  prisma: PrismaService,
  id: string,
): Promise<void> {
  await prisma.stageAssignment.delete({ where: { id } });
}

export async function listStageAssignments(
  prisma: PrismaService,
  projectId: string,
): Promise<StageAssignment[]> {
  const rows = await prisma.stageAssignment.findMany({
    where: { projectId },
    include: {
      stage: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) =>
    stageAssignmentSchema.parse({
      id: row.id,
      userId: row.userId,
      stageId: row.stageId,
      projectId: row.projectId,
      stageName: row.stage.name,
      userName: row.user.name,
    }),
  );
}

/**
 * Full SDLC stage catalogue. Used by the Stage Assignment editor so it can
 * render *every* stage (including unassigned ones), not just the stages that
 * already have an assignment row for the project.
 */
export async function listStages(
  prisma: PrismaService,
): Promise<{ id: string; name: string; sortOrder: number }[]> {
  return prisma.stage.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
}

/**
 * Per-project assignment count for the products-tab "X/7 stages" header.
 * Light query (single GROUP BY) so we can render the count without loading
 * every assignment row.
 */
export async function listStageAssignmentCounts(
  prisma: PrismaService,
): Promise<{ projectId: string; count: number }[]> {
  const rows = await prisma.stageAssignment.groupBy({
    by: ["projectId"],
    _count: { _all: true },
  });
  return rows.map((r) => ({ projectId: r.projectId, count: r._count._all }));
}
