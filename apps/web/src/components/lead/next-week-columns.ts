import type { KanbanItem, Product } from "./mock-data";
import { splitStageNames } from "./stage-tags";

/**
 * Column model for the Next Week board (extracted from next-week-section.tsx):
 * one column per assigned product so empty products still get a "+ Add" CTA,
 * falling back to stage-tag grouping when `products` is not supplied.
 */
export interface ItemColumn {
  readonly key: string;
  readonly productId: string;
  readonly productName: string;
  readonly items: KanbanItem[];
}

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  const map = new Map<string, KanbanItem[]>();
  for (const item of items) {
    const tags =
      item.stageIds && item.stageIds.length > 0
        ? item.stageIds
        : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
          splitStageNames(item.stageName);
    const key =
      tags.length > 0
        ? `${item.productName} · ${tags.join(", ")}`
        : item.productName;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export function buildItemColumns(
  products: readonly Product[] | undefined,
  items: KanbanItem[],
): ItemColumn[] {
  if (products && products.length > 0) {
    return products.map((p) => ({
      key: p.name,
      productId: p.id,
      productName: p.name,
      items: items.filter((it) => it.productId === p.id),
    }));
  }
  return [...groupByProduct(items).entries()].flatMap(
    ([productName, gItems]) => {
      const first = gItems.at(0);
      if (!first) return [];
      return [
        {
          key: productName,
          productId: first.productId,
          productName: first.productName,
          items: gItems,
        },
      ];
    },
  );
}

/** True when the board has neither items nor any product column to seed. */
export function isBoardEmpty(
  items: KanbanItem[],
  products: readonly Product[] | undefined,
): boolean {
  return items.length === 0 && (!products || products.length === 0);
}
