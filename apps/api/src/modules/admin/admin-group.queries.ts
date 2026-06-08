import {
  type ReportingGroup,
  reportingGroupSchema,
  type StageAssignment,
  stageAssignmentSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";

/**
 * ReportingGroup + StageAssignment domain queries, extracted from
 * `admin.prisma-repository.ts` (R3a-4 max-lines split). `ensureFallbackReportingGroup`
 * is also consumed by the snapshot domain (saveSnapshot), so it is exported.
 */

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";
const DEFAULT_REPORTING_GROUP_NAME = "Core Development";

export async function ensureFallbackReportingGroup(
  prisma: PrismaService,
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

export async function saveStageAssignment(
  prisma: PrismaService,
  data: {
    userId: string;
    stageId: string;
    projectId: string;
  },
): Promise<StageAssignment> {
  const existing = await prisma.stageAssignment.findFirst({
    where: { stageId: data.stageId, projectId: data.projectId },
    select: { id: true },
  });

  const row = existing
    ? await prisma.stageAssignment.update({
        where: { id: existing.id },
        data: { userId: data.userId },
        include: {
          stage: { select: { name: true } },
          user: { select: { name: true } },
        },
      })
    : await prisma.stageAssignment.create({
        data,
        include: {
          stage: { select: { name: true } },
          user: { select: { name: true } },
        },
      });

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
