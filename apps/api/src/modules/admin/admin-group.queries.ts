import {
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { lockAndAssertGroupHead } from "../../lib/user-activity-assignment.js";

export async function saveReportingGroup(
  prisma: PrismaService,
  group: ReportingGroup,
): Promise<ReportingGroup> {
  const row = await prisma.$transaction(async (tx) => {
    await lockAndAssertGroupHead(tx, group.headUserId);
    return tx.reportingGroup.upsert({
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
