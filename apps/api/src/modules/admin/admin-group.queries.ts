import {
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { lockAndAssertGroupHead } from "../../lib/user-activity-assignment.js";
import { AdminReportingGroupNotFoundError } from "./admin-shared.js";

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
  // Only a missing row (P2025) becomes a typed NOT_FOUND; the schema parse
  // stays outside the catch so a corrupt row never masquerades as missing.
  const row = await prisma.reportingGroup
    .update({
      where: { id: groupId },
      data: { archived: true },
    })
    .catch((error: unknown) => {
      const prismaError = error as { code?: string } | null;
      if (prismaError?.code === "P2025") {
        throw new AdminReportingGroupNotFoundError(
          `Reporting group ${groupId} was not found.`,
        );
      }
      throw error;
    });

  return reportingGroupSchema.parse(row);
}
