import type { ReportSectionReadModel } from "@customreport/shared";

import { hasText } from "./slide-grid-rows";

export interface GridPriorityCard {
  readonly id: string;
  readonly productId: string;
  readonly rank: number;
  readonly text: string;
  readonly productName: string;
  readonly authorId: string;
}

/** Own ranked items only (foreign rows never carry a rank), ascending rank;
 * ties keep input order — the section author is the only rank source today. */
export function buildPriorityStrip(input: {
  readonly section: ReportSectionReadModel;
  readonly productNameById: ReadonlyMap<string, string>;
  readonly activityHomeById: ReadonlyMap<string, string>;
  readonly sharedCardId: string;
  readonly sharedCardName: string;
}): readonly GridPriorityCard[] {
  const { section, productNameById, activityHomeById } = input;
  const cards = section.items.flatMap((item, index) => {
    const rank = item.priorityRank;
    if (rank == null || !hasText(item.text)) return [];
    const homeProductId =
      item.activityId != null
        ? (activityHomeById.get(item.activityId) ?? input.sharedCardId)
        : (item.projectId ?? input.sharedCardId);
    return [
      {
        id: item.id ?? item.stableId ?? `priority-${String(index)}`,
        productId: homeProductId,
        rank,
        text: item.text.trim(),
        productName: productNameById.get(homeProductId) ?? input.sharedCardName,
        authorId: section.authorId,
      },
    ];
  });
  return [...cards].sort((a, b) => a.rank - b.rank);
}
