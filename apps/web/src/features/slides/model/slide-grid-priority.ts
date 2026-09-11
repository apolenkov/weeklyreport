import type { ReportSectionReadModel } from "@customreport/shared";

import { hasText } from "./slide-grid-rows";
import {
  attributedRecordAuthor,
  type SlideRecordAttribution,
} from "./slide-record-attribution";

export interface GridPriorityCard {
  // null when the item carries neither id nor stableId — the render key falls
  // back to array position locally; no positional identity is fabricated.
  readonly id: string | null;
  readonly productId: string;
  readonly rank: number;
  readonly text: string;
  readonly productName: string;
  readonly authorId: string;
}

// Own ranked items only (foreign rows never carry a rank), ascending rank;
// ties keep input order — the section author is the only rank source today.
export function buildPriorityStrip(input: {
  readonly recordAttribution?: SlideRecordAttribution | undefined;
  readonly section: ReportSectionReadModel;
  readonly knownProductIds: ReadonlySet<string>;
  readonly productNameById: ReadonlyMap<string, string>;
  readonly activityHomeById: ReadonlyMap<string, string>;
  readonly sharedCardId: string;
  readonly sharedCardName: string;
}): readonly GridPriorityCard[] {
  const { section, knownProductIds, productNameById, activityHomeById } = input;
  const cards = section.items.flatMap((item) => {
    const rank = item.priorityRank;
    if (rank == null || !hasText(item.text)) return [];
    const homeProductId =
      item.activityId != null
        ? (activityHomeById.get(item.activityId) ?? input.sharedCardId)
        : item.projectId != null && knownProductIds.has(item.projectId)
          ? item.projectId
          : input.sharedCardId;
    return [
      {
        id: item.id ?? item.stableId ?? null,
        productId: homeProductId,
        rank,
        text: item.text.trim(),
        productName: productNameById.get(homeProductId) ?? input.sharedCardName,
        authorId: input.recordAttribution
          ? attributedRecordAuthor(item, input.recordAttribution).id
          : section.authorId,
      },
    ];
  });
  return [...cards].sort((a, b) => a.rank - b.rank);
}
