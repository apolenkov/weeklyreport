import {
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";

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
