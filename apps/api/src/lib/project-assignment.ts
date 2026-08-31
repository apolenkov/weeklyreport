import type { Prisma } from "@prisma/client";

import { lockCurrentEditableReport } from "./report-lifecycle.js";
import { lockStatusGraph } from "./status-graph-lock.js";
import { lockAndValidateProjectOwnership } from "./user-activity-assignment.js";

export interface ProjectAssignmentInput {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly leadId: string;
}

/** Upserts a project and reconciles only its live editable section statuses. */
export async function reconcileProjectAssignment(
  tx: Prisma.TransactionClient,
  project: ProjectAssignmentInput,
): Promise<void> {
  await lockStatusGraph(tx);
  await lockAndValidateProjectOwnership(tx, {
    projectId: project.id,
    desiredLeadId: project.leadId,
  });
  const existing = await tx.project.findUnique({
    where: { id: project.id },
    select: { leadId: true },
  });
  await reconcileProjectAssignmentRows(tx, project, existing?.leadId);
}

/**
 * Applies a snapshot's already-validated final assignment graph. Snapshot
 * restore validates all users, heads, projects and activity edges together;
 * checking each row against the transient graph would reject valid swaps.
 */
export async function reconcileRestoredProjectAssignment(
  tx: Prisma.TransactionClient,
  project: ProjectAssignmentInput,
  previousLeadId: string | null,
): Promise<void> {
  await reconcileProjectAssignmentRows(tx, project, previousLeadId);
}

async function reconcileProjectAssignmentRows(
  tx: Prisma.TransactionClient,
  project: ProjectAssignmentInput,
  previousLeadId: string | null | undefined,
): Promise<void> {
  const editableReports = await lockAllEditableReports(tx);
  const leadIds = [
    ...new Set(
      [previousLeadId, project.leadId].filter(
        (leadId): leadId is string => leadId != null,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));

  await tx.project.upsert({
    where: { id: project.id },
    // Admin snapshots also carry the denormalized `leadName` display field.
    // It is not a Project column and must never cross the Prisma write boundary.
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
  if (editableReports.length === 0) return;

  const sections = await tx.reportSection.findMany({
    where: { reportId: { in: editableReports }, authorId: { in: leadIds } },
    select: { id: true, authorId: true },
  });
  const oldSections = sections
    .filter(({ authorId }) => authorId !== project.leadId)
    .map(({ id }) => id);
  if (oldSections.length > 0) {
    await tx.projectStatus.deleteMany({
      where: { reportSectionId: { in: oldSections }, projectId: project.id },
    });
  }
  if (!project.archived) {
    const newSections = sections
      .filter(({ authorId }) => authorId === project.leadId)
      .map(({ id }) => id);
    if (newSections.length > 0) {
      await tx.projectStatus.createMany({
        data: newSections.map((reportSectionId) => ({
          reportSectionId,
          projectId: project.id,
          status: null,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function lockAllEditableReports(
  tx: Prisma.TransactionClient,
): Promise<string[]> {
  const candidates = await tx.report.findMany({
    where: {
      archived: false,
      periodState: "open",
      OR: [
        { status: "draft", periodStatus: "open" },
        { status: "published", periodStatus: "reopened" },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const editableReports: string[] = [];
  for (const { id } of candidates) {
    const gate = await lockCurrentEditableReport(tx, { reportId: id });
    if (gate.kind === "editable") editableReports.push(gate.reportId);
  }
  return editableReports;
}
