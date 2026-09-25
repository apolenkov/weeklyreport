import {
  type StageAssignment,
  stageAssignmentSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import { lockAllEditableReports } from "../../lib/project-assignment.js";
import { lockStatusGraph } from "../../lib/status-graph-lock.js";

interface StageAssignmentInput {
  readonly userId: string;
  readonly stageId: string;
  readonly projectId: string;
}

const STAGE_ASSIGNMENT_RELATIONS = {
  stage: { select: { name: true } },
  user: { select: { name: true } },
} satisfies Prisma.StageAssignmentInclude;

// Reassign updates userId only. Prisma upsert on this compound key is not
// native ON CONFLICT, so concurrent first-assigns race P2002 and the loser
// applies the same update explicitly. StageAssignment writes change the live
// `current.projects` section projection, so the DML serializes on the status
// graph and every editable Report row — the locks carry-over shares.
async function upsertStageAssignmentRow(
  prisma: PrismaService,
  data: StageAssignmentInput,
) {
  const where = {
    stageId_projectId: { stageId: data.stageId, projectId: data.projectId },
  };
  try {
    return await prisma.$transaction(async (tx) => {
      await lockStatusGraph(tx);
      await lockAllEditableReports(tx);
      return tx.stageAssignment.upsert({
        where,
        create: data,
        update: { userId: data.userId },
        include: STAGE_ASSIGNMENT_RELATIONS,
      });
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
    // The conflict aborted the first transaction — never write through its
    // client again. Recovery relocks the graph and reports on a fresh client
    // before the same compound-identity update.
    return prisma.$transaction(async (tx) => {
      await lockStatusGraph(tx);
      await lockAllEditableReports(tx);
      return tx.stageAssignment.update({
        where,
        data: { userId: data.userId },
        include: STAGE_ASSIGNMENT_RELATIONS,
      });
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
  await prisma.$transaction(async (tx) => {
    await lockStatusGraph(tx);
    await lockAllEditableReports(tx);
    await tx.stageAssignment.delete({ where: { id } });
  });
}

export async function listStageAssignments(
  prisma: PrismaService,
  projectId: string,
): Promise<StageAssignment[]> {
  const rows = await prisma.stageAssignment.findMany({
    where: { projectId },
    include: STAGE_ASSIGNMENT_RELATIONS,
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

// Full catalogue including stages that have no assignment row yet.
export async function listStages(
  prisma: PrismaService,
): Promise<{ id: string; name: string; sortOrder: number }[]> {
  return prisma.stage.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
}

// Grouped counts feed the products-tab header without loading every row.
export async function listStageAssignmentCounts(
  prisma: PrismaService,
): Promise<{ projectId: string; count: number }[]> {
  const rows = await prisma.stageAssignment.groupBy({
    by: ["projectId"],
    _count: { _all: true },
  });
  return rows.map((row) => ({
    projectId: row.projectId,
    count: row._count._all,
  }));
}
