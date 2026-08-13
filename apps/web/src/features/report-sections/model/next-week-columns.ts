import { splitStageNames } from "./stage-tags";
import type {
  ActivityKanbanItem,
  KanbanItem,
  Product,
  ProductKanbanItem,
} from "./types";

type BoardColumnParent = Exclude<
  KanbanItem["parent"],
  { readonly kind: "unresolved" }
>;

// One column per assigned product so empty products still get a "+ Add" CTA;
// an explicitly empty assignment list still groups stored rows by product id.
// Stage-tag grouping is only for callers that do not supply product data.
export interface ItemColumn {
  readonly key: string;
  readonly parent: BoardColumnParent;
  readonly productId: string | null;
  readonly productName: string;
  readonly activityId: string | null;
  readonly items: readonly KanbanItem[];
}

export interface LaneActivity {
  readonly id: string;
  readonly name: string;
}

// One lane per attached activity (empty lanes keep the structure visible).
// Orphan activity ids that own rows but aren't attached are appended so no
// row is dropped. With no attached list, lanes fall back to row-owning activities.
function activityLanes(
  items: readonly ActivityKanbanItem[],
  activities: readonly LaneActivity[],
): ItemColumn[] {
  const nameById = new Map(activities.map((a) => [a.id, a.name]));
  const orphanIds = [
    ...new Set(
      items.map((it) => it.activityId).filter((id) => !nameById.has(id)),
    ),
  ];
  const laneIds = [...activities.map((a) => a.id), ...orphanIds];
  return laneIds.map((activityId) => {
    const laneItems = items.filter((it) => it.activityId === activityId);
    const name =
      nameById.get(activityId) ??
      laneItems.at(0)?.activityName ??
      laneItems.at(0)?.productName ??
      "Activity";
    return {
      key: `activity:${activityId}`,
      parent: { kind: "activity", id: activityId },
      productId: null,
      productName: name,
      activityId,
      items: laneItems,
    };
  });
}

function groupKeyFor(item: ProductKanbanItem): string {
  const tags =
    item.stageNames && item.stageNames.length > 0
      ? item.stageNames
      : splitStageNames(item.stageName);
  return tags.length > 0
    ? `${item.parent.id} · ${tags.join(", ")}`
    : item.parent.id;
}

function groupByProduct(
  items: readonly ProductKanbanItem[],
): Map<string, ProductKanbanItem[]> {
  return Map.groupBy(items, groupKeyFor);
}

function productColumnsFor(
  products: readonly Product[],
  productRows: readonly ProductKanbanItem[],
): ItemColumn[] {
  const assignedProductIds = new Set(products.map((product) => product.id));
  const rowsByProductId = Map.groupBy(productRows, (item) => item.productId);
  const assignedColumns = products.map((product) => ({
    key: product.id,
    parent: { kind: "product", id: product.id } as const,
    productId: product.id,
    productName: product.name,
    activityId: null,
    items: rowsByProductId.get(product.id) ?? [],
  }));
  const orphanColumns: ItemColumn[] = [];
  for (const [productId, orphanItems] of rowsByProductId) {
    if (assignedProductIds.has(productId)) continue;
    const firstItem = orphanItems.at(0);
    if (!firstItem) continue;
    orphanColumns.push({
      key: productId,
      parent: { kind: "product", id: productId },
      productId,
      productName: firstItem.productName,
      activityId: null,
      items: orphanItems,
    });
  }
  return [...assignedColumns, ...orphanColumns];
}

// Product columns in the shared grid; activity lanes in a lighter block below
// (activities are their own row, never peer product columns).
export function splitItemBoard(
  products: readonly Product[] | undefined,
  items: readonly KanbanItem[],
  activities: readonly LaneActivity[] = [],
): { productColumns: ItemColumn[]; activityLanes: ItemColumn[] } {
  const productRows = items.filter(
    (it): it is ProductKanbanItem => it.parent.kind === "product",
  );
  const activityRows = items.filter(
    (it): it is ActivityKanbanItem => it.parent.kind === "activity",
  );
  const lanes = activityLanes(activityRows, activities);
  if (products !== undefined) {
    return {
      productColumns: productColumnsFor(products, productRows),
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
            parent: first.parent,
            productId: first.productId,
            productName: first.productName,
            activityId: null,
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
export function isBoardEmpty(
  items: readonly KanbanItem[],
  products: readonly Product[] | undefined,
  activities: readonly LaneActivity[] = [],
): boolean {
  return (
    items.length === 0 &&
    (!products || products.length === 0) &&
    activities.length === 0
  );
}
