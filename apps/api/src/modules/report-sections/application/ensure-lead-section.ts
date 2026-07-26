import type { PrismaClient } from "@prisma/client";

import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";

/**
 * Provision a lead's `ReportSection` (and its seeded `ProjectStatus` rows) for a
 * given period. This is report-section domain logic, which `period-dual-state`
 * classifies as a non-period (child-row) writer, so it is exempt from the period
 * transition boundary. `buildUserSession` reaches it through an injected seam at
 * login.
 *
 * Concurrency: two concurrent first-logins of the SAME lead could both miss the
 * fast-path find and both create, hitting the `ReportSection_reportId_authorId_key`
 * unique index. The fast path stays a cheap `findUnique`; the create is guarded
 * by a catch-on-unique-violation + re-read so the loser resolves to the winner's
 * section instead of throwing. `ProjectStatus` rows are seeded only on a fresh
 * create (the winner does it; `createMany({ skipDuplicates })` is itself safe).
 */

const DEFAULT_PROJECT_STATUS = "green" as const;
const SECTION_UNIQUE_INDEX = "ReportSection_reportId_authorId_key";

function isSectionUniqueViolation(error: unknown): boolean {
  return isUniqueViolation(error, {
    index: SECTION_UNIQUE_INDEX,
    columns: ["reportId", "authorId"],
  });
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
      status: DEFAULT_PROJECT_STATUS,
    })),
    skipDuplicates: true,
  });
}

// Mirrors seedProjectStatuses for Project Activities: one ActivityStatus row
// (default green, never null) per non-archived activity the lead is attached
// to. The seeded set is the server-authoritative reference the save path
// validates written activityIds against.
// Seed-once-at-provisioning, same as seedProjectStatuses above: a mid-period
// attach surfaces at the next period's provisioning, not retroactively.
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
      status: DEFAULT_PROJECT_STATUS,
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
  const existing = await prisma.reportSection.findUnique({
    where: { reportId_authorId: { reportId, authorId: userId } },
    select: { id: true },
  });
  if (existing) return { sectionId: existing.id };

  try {
    return await prisma.$transaction(async (tx) => {
      const section = await tx.reportSection.create({
        data: { reportId, authorId: userId },
        select: { id: true },
      });
      await seedProjectStatuses(tx, section.id, userId);
      await seedActivityStatuses(tx, section.id, userId);
      return { sectionId: section.id };
    });
  } catch (error) {
    if (!isSectionUniqueViolation(error)) throw error;
    const won = await prisma.reportSection.findUnique({
      where: { reportId_authorId: { reportId, authorId: userId } },
      select: { id: true },
    });
    if (!won) throw error;
    return { sectionId: won.id };
  }
}
