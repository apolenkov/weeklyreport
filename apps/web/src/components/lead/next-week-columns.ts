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
  /**
   * Set on an activity lane — the column groups activity-parented rows.
   * `productId` is empty and `productName` carries the activity name on
   * these lanes.
   */
  readonly activityId?: string;
  readonly items: KanbanItem[];
}

/**
 * One lane per activity that owns rows, in first-appearance order. Unlike
 * product columns (which render empty for the "+ Add" CTA), an activity lane
 * exists only when it has rows — creation goes through the dialog's parent
 * picker, so an empty lane would advertise nothing.
 */
function activityLanes(items: KanbanItem[]): ItemColumn[] {
  const activityRows = items.filter((it) => it.activityId != null);
  const laneIds = [...new Set(activityRows.map((it) => it.activityId))];
  return laneIds.flatMap((activityId) => {
    if (activityId == null) return [];
    const laneItems = activityRows.filter((it) => it.activityId === activityId);
    const first = laneItems.at(0);
    if (!first) return [];
    return [
      {
        key: `activity:${activityId}`,
        productId: "",
        productName: first.activityName ?? first.productName,
        activityId,
        items: laneItems,
      },
    ];
  });
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

/**
 * The board's two levels, split so the sections can render product columns in
 * the shared grid and activity lanes in the lighter block below it (the slide
 * precedent — activities are their own row, never peer product columns).
 */
export function splitItemBoard(
  products: readonly Product[] | undefined,
  items: KanbanItem[],
): { productColumns: ItemColumn[]; activityLanes: ItemColumn[] } {
  // Activity rows carry productId "" — they'd match no product column and
  // silently vanish, so they always route through their own lanes.
  const productRows = items.filter((it) => it.activityId == null);
  const lanes = activityLanes(items);
  if (products && products.length > 0) {
    return {
      productColumns: products.map((p) => ({
        key: p.name,
        productId: p.id,
        productName: p.name,
        items: productRows.filter((it) => it.productId === p.id),
      })),
      activityLanes: lanes,
    };
  }
  return {
    productColumns: [...groupByProduct(productRows).entries()].flatMap(
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
    ),
    activityLanes: lanes,
  };
}

export function buildItemColumns(
  products: readonly Product[] | undefined,
  items: KanbanItem[],
): ItemColumn[] {
  const board = splitItemBoard(products, items);
  return [...board.productColumns, ...board.activityLanes];
}

/** True when the board has neither items nor any product column to seed. */
export function isBoardEmpty(
  items: KanbanItem[],
  products: readonly Product[] | undefined,
): boolean {
  return items.length === 0 && (!products || products.length === 0);
}
