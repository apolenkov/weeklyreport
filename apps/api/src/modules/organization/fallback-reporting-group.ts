import { DEFAULT_REPORTING_GROUP } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

// Existing active groups win; a fresh installation materializes the canonical
// fallback with an upsert so concurrent first users converge on one row.
export async function ensureFallbackReportingGroup(
  prisma: Prisma.TransactionClient,
): Promise<string> {
  const existing = await prisma.reportingGroup.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.reportingGroup.upsert({
    where: { id: DEFAULT_REPORTING_GROUP.id },
    create: {
      ...DEFAULT_REPORTING_GROUP,
      archived: false,
    },
    update: { archived: false },
    select: { id: true },
  });
  return created.id;
}
