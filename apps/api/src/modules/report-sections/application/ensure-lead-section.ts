import type { Prisma, PrismaClient } from "@prisma/client";

import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import { lockStatusGraph } from "../../../lib/status-graph-lock.js";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
} from "./report-sections.contract.js";

// Provision a lead's `ReportSection` + seeded `ProjectStatus` rows at login.
// Parent-first locking serializes provisioning with publish/archive transitions
// and concurrent first logins before either reads or creates the child row.
const INITIAL_STATUS = null;

async function assertEditableReport(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<void> {
  const gate = await lockCurrentEditableReport(tx, { reportId });
  if (gate.kind === "not-found") {
    throw new ReportSectionNotFoundError("The report no longer exists.");
  }
  if (gate.kind === "inconsistent") throw new PeriodLifecycleIntegrityError();
  if (gate.kind === "not-editable") {
    throw new ReportSectionDomainError(
      "SECTION_ALREADY_SUBMITTED",
      "Cannot provision a section outside an editable report.",
    );
  }
}

async function seedProjectStatuses(
  prisma: {
    project: PrismaClient["project"];
    projectStatus: PrismaClient["projectStatus"];
  },
  reportSectionId: string,
  userId: string,
): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { leadId: userId, archived: false },
    select: { id: true },
  });
  if (projects.length === 0) return;
  await prisma.projectStatus.createMany({
    data: projects.map((p) => ({
      reportSectionId,
      projectId: p.id,
      status: INITIAL_STATUS,
    })),
    skipDuplicates: true,
  });
}

async function seedActivityStatuses(
  prisma: {
    projectActivityLead: PrismaClient["projectActivityLead"];
    activityStatus: PrismaClient["activityStatus"];
  },
  reportSectionId: string,
  userId: string,
): Promise<void> {
  const attachments = await prisma.projectActivityLead.findMany({
    where: { leadId: userId, activity: { archived: false } },
    select: { activityId: true },
  });
  if (attachments.length === 0) return;
  await prisma.activityStatus.createMany({
    data: attachments.map((attachment) => ({
      reportSectionId,
      activityId: attachment.activityId,
      status: INITIAL_STATUS,
    })),
    skipDuplicates: true,
  });
}

export async function ensureLeadSection(
  prisma: Pick<
    PrismaClient,
    | "reportSection"
    | "project"
    | "projectStatus"
    | "projectActivityLead"
    | "activityStatus"
    | "$transaction"
  >,
  reportId: string,
  userId: string,
): Promise<{ sectionId: string }> {
  return prisma.$transaction(async (tx) => {
    await lockStatusGraph(tx);
    await assertEditableReport(tx, reportId);
    const existing = await tx.reportSection.findUnique({
      where: { reportId_authorId: { reportId, authorId: userId } },
      select: { id: true },
    });
    if (existing) return { sectionId: existing.id };

    const section = await tx.reportSection.create({
      data: { reportId, authorId: userId },
      select: { id: true },
    });
    await seedProjectStatuses(tx, section.id, userId);
    await seedActivityStatuses(tx, section.id, userId);
    return { sectionId: section.id };
  });
}
