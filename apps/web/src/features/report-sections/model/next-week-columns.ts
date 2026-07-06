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

/** The attached-activity shape a lane is seeded from (id + display name). */
export interface LaneActivity {
  readonly id: string;
  readonly name: string;
}

/**
 * One lane per ATTACHED activity, in attached order — activities behave like
 * products: an attached activity with no rows still gets an empty lane with a
 * "+ Add" CTA, so the reporting structure is visible before anything is filled.
 * Any activity that owns rows but is not in the attached list (defensive — the
 * write path forbids it) is appended so no row is ever dropped. With no attached
 * activities supplied, lanes fall back to the activities that own rows (the
 * legacy items-derived behavior, kept for `buildItemColumns` callers).
 */
function activityLanes(
  items: KanbanItem[],
  activities: readonly LaneActivity[],
): ItemColumn[] {
  const activityRows = items.filter((it) => it.activityId != null);
  const nameById = new Map(activities.map((a) => [a.id, a.name]));
  const orphanIds = [
    ...new Set(
      activityRows
        .map((it) => it.activityId)
        .filter((id): id is string => id != null && !nameById.has(id)),
    ),
  ];
  const laneIds = [...activities.map((a) => a.id), ...orphanIds];
  return laneIds.map((activityId) => {
    const laneItems = activityRows.filter((it) => it.activityId === activityId);
    const name =
      nameById.get(activityId) ??
      laneItems.at(0)?.activityName ??
      laneItems.at(0)?.productName ??
      "Activity";
    return {
      key: `activity:${activityId}`,
      productId: "",
      productName: name,
      activityId,
      items: laneItems,
    };
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
  activities: readonly LaneActivity[] = [],
): { productColumns: ItemColumn[]; activityLanes: ItemColumn[] } {
  // Activity rows carry productId "" — they'd match no product column and
  // silently vanish, so they always route through their own lanes.
  const productRows = items.filter((it) => it.activityId == null);
  const lanes = activityLanes(items, activities);
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

/**
 * True when the board has nothing to render at all — no items, no product
 * column, and no attached activity lane. An attached activity (like a product)
 * seeds an empty lane, so its presence keeps the board non-empty.
 */
export function isBoardEmpty(
  items: KanbanItem[],
  products: readonly Product[] | undefined,
  activities: readonly LaneActivity[] = [],
): boolean {
  return (
    items.length === 0 &&
    (!products || products.length === 0) &&
    activities.length === 0
  );
}
