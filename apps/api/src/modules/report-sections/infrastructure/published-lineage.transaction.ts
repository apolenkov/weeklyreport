import type { Prisma } from "@prisma/client";
import type { PublishedLineage } from "@weeklyreport/shared";

import { queryPublishedLineage } from "./published-lineage.query.js";

interface SectionLineageTarget {
  readonly reportId: string;
  readonly reportSectionId: string;
}

/** Reads current stable IDs and resolves their published lineage in one transaction. */
export async function querySectionPublishedLineageTx(
  tx: Prisma.TransactionClient,
  target: SectionLineageTarget,
): Promise<PublishedLineage> {
  const [items, decisions] = await Promise.all([
    tx.item.findMany({
      where: { reportSectionId: target.reportSectionId },
      select: { stableId: true },
    }),
    tx.decision.findMany({
      where: { reportSectionId: target.reportSectionId },
      select: { stableId: true },
    }),
  ]);

  return queryPublishedLineage(tx, {
    ...target,
    itemStableIds: items.map((item) => item.stableId),
    decisionStableIds: decisions.map((decision) => decision.stableId),
  });
}
