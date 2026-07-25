import { splitStageNames } from "./stage-tags";
import type { KanbanItem, Product } from "./types";

// One column per assigned product so empty products still get a "+ Add" CTA;
// falls back to stage-tag grouping when `products` is not supplied.
export interface ItemColumn {
  readonly key: string;
  readonly productId: string;
  readonly productName: string;
  // Set on an activity lane — productId is empty; productName is the activity name.
  readonly activityId?: string;
  readonly items: KanbanItem[];
}

export interface LaneActivity {
  readonly id: string;
  readonly name: string;
}

// One lane per attached activity (empty lanes keep the structure visible).
// Orphan activity ids that own rows but aren't attached are appended so no
// row is dropped. With no attached list, lanes fall back to row-owning activities.
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

function groupKeyFor(item: KanbanItem): string {
  const tags =
    item.stageIds && item.stageIds.length > 0
      ? item.stageIds
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(item.stageName);
  return tags.length > 0
    ? `${item.productName} · ${tags.join(", ")}`
    : item.productName;
}

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  return Map.groupBy(items, groupKeyFor);
}

// Product columns in the shared grid; activity lanes in a lighter block below
// (activities are their own row, never peer product columns).
/**
 * Split Item Board.
 * @param products - The products argument.
 * @param items - The items argument.
 * @param activities - The activities argument.
 */
export function splitItemBoard(
  products: readonly Product[] | undefined,
  items: KanbanItem[],
  activities: readonly LaneActivity[] = [],
): { productColumns: ItemColumn[]; activityLanes: ItemColumn[] } {
  // Activity rows carry productId "" — route through lanes so they never vanish.
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

// Attached activities (like products) seed empty lanes, so their presence
// keeps the board non-empty even with zero items.
/**
 * Is Board Empty.
 * @param items - The items argument.
 * @param products - The products argument.
 * @param activities - The activities argument.
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
