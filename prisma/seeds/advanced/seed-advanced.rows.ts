// Upsert shapes shared by the active, published and history generations: the
// natural key decides identity, the surrogate id is only written on create.

import type {
  ItemType,
  ItemWorkflowStatus,
  PrismaClient,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

export interface SectionRow {
  readonly id: string;
  readonly reportId: string;
  readonly authorId: string;
  readonly status: ReportSectionStatus;
  readonly submittedAt: Date | null;
}

export interface ProjectStatusRow {
  readonly id: string;
  readonly reportSectionId: string;
  readonly projectId: string;
  readonly status: TrafficLightStatus;
}

export interface ItemRow {
  readonly id: string;
  readonly reportSectionId: string;
  readonly projectId: string;
  readonly type: ItemType;
  readonly text: string;
  readonly tag: string;
  readonly workflowStatus: ItemWorkflowStatus;
  readonly stageNames: string[];
}

export async function upsertSection(
  prisma: PrismaClient,
  row: SectionRow,
): Promise<void> {
  await prisma.reportSection.upsert({
    where: {
      reportId_authorId: { reportId: row.reportId, authorId: row.authorId },
    },
    update: { id: row.id, status: row.status, submittedAt: row.submittedAt },
    create: row,
  });
}

export async function upsertProjectStatus(
  prisma: PrismaClient,
  row: ProjectStatusRow,
): Promise<void> {
  await prisma.projectStatus.upsert({
    where: {
      reportSectionId_projectId: {
        reportSectionId: row.reportSectionId,
        projectId: row.projectId,
      },
    },
    update: { id: row.id, status: row.status },
    create: row,
  });
}

export async function upsertItem(
  prisma: PrismaClient,
  { id, ...fields }: ItemRow,
): Promise<void> {
  await prisma.item.upsert({
    where: { id },
    update: fields,
    create: { id, ...fields },
  });
}
