import { Prisma } from "@prisma/client";

/** Locks restored reports after reminder policies/rules, before period writes. */
export async function lockRestoredReports(
  tx: Prisma.TransactionClient,
  reportIds: readonly string[],
): Promise<void> {
  const orderedIds = [...new Set(reportIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (orderedIds.length === 0) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Report"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id" FOR UPDATE
  `);
}
