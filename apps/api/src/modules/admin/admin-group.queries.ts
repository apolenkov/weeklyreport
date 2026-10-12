import {
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { lockAndAssertGroupHead } from "../../lib/user-activity-assignment.js";
import {
  AdminLastActiveGroupError,
  AdminReportingGroupNotFoundError,
} from "./admin-shared.js";

// Both catalog archiving paths lock the active set in stable order. Re-read
// after the lock wait so a competing commit cannot leave a stale count.
async function assertNotLastActiveGroup(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT "id" FROM "ReportingGroup"
    WHERE "archived" = false ORDER BY "id" FOR UPDATE
  `;
  const activeGroups = await tx.reportingGroup.findMany({
    where: { archived: false },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (activeGroups.length === 1 && activeGroups[0]?.id === groupId) {
    throw new AdminLastActiveGroupError(
      "The last active reporting group cannot be archived. Create or restore another group first.",
    );
  }
}

export async function saveReportingGroup(
  prisma: PrismaService,
  group: ReportingGroup,
): Promise<ReportingGroup> {
  const row = await prisma.$transaction(
    async (tx) => {
      await lockAndAssertGroupHead(tx, group.headUserId, group.id);
      if (group.archived) await assertNotLastActiveGroup(tx, group.id);
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
    },
    { isolationLevel: "ReadCommitted" },
  );

  return reportingGroupSchema.parse(row);
}

export async function archiveReportingGroup(
  prisma: PrismaService,
  groupId: string,
): Promise<ReportingGroup> {
  // Only a missing row (P2025) becomes a typed NOT_FOUND; the schema parse
  // stays outside the catch so a corrupt row never masquerades as missing.
  const row = await prisma
    .$transaction(
      async (tx) => {
        await assertNotLastActiveGroup(tx, groupId);
        return tx.reportingGroup.update({
          where: { id: groupId },
          data: { archived: true },
        });
      },
      { isolationLevel: "ReadCommitted" },
    )
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
