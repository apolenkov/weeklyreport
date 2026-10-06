import {
  type StageAssignment,
  stageAssignmentSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isForeignKeyViolation } from "../../lib/prisma-foreign-key-violation.js";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import { lockAllEditableReports } from "../../lib/project-assignment.js";
import { lockStatusGraph } from "../../lib/status-graph-lock.js";
import {
  AdminStageAssignmentNotFoundError,
  AdminStageAssignmentReferenceNotFoundError,
} from "./admin-shared.js";

interface StageAssignmentInput {
  readonly userId: string;
  readonly stageId: string;
  readonly projectId: string;
}

const STAGE_ASSIGNMENT_RELATIONS = {
  stage: { select: { name: true } },
  user: { select: { name: true } },
} satisfies Prisma.StageAssignmentInclude;

// The only reference FKs a StageAssignment write can trip — a P2003 on one of
// these means the named user/stage/project does not exist. A P2003 with no
// matching constraint is an unrelated integrity failure and re-throws.
const STAGE_ASSIGNMENT_REFERENCE_SCOPES = [
  { index: "StageAssignment_userId_fkey", label: "user" },
  { index: "StageAssignment_stageId_fkey", label: "stage" },
  { index: "StageAssignment_projectId_fkey", label: "project" },
] as const;

// Throws the typed NOT_FOUND when `error` is a missing-reference P2003 on a
// known StageAssignment FK; returns otherwise so the caller re-throws.
function throwIfMissingStageAssignmentReference(error: unknown): void {
  for (const { index, label } of STAGE_ASSIGNMENT_REFERENCE_SCOPES) {
    if (isForeignKeyViolation(error, { index })) {
      throw new AdminStageAssignmentReferenceNotFoundError(
        `The referenced ${label} does not exist.`,
      );
    }
  }
}

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
    throwIfMissingStageAssignmentReference(error);
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
    try {
      return await prisma.$transaction(async (tx) => {
        await lockStatusGraph(tx);
        await lockAllEditableReports(tx);
        return tx.stageAssignment.update({
          where,
          data: { userId: data.userId },
          include: STAGE_ASSIGNMENT_RELATIONS,
        });
      });
    } catch (retryError) {
      throwIfMissingStageAssignmentReference(retryError);
      throw retryError;
    }
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
  try {
    await prisma.$transaction(async (tx) => {
      await lockStatusGraph(tx);
      await lockAllEditableReports(tx);
      await tx.stageAssignment.delete({ where: { id } });
    });
  } catch (error: unknown) {
    // Only a missing row (P2025) becomes a typed NOT_FOUND; any other failure
    // propagates unchanged.
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2025") {
      throw new AdminStageAssignmentNotFoundError(
        `Stage assignment ${id} was not found.`,
      );
    }
    throw error;
  }
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
