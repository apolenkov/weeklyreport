import type { ReportSectionReadModel } from "@customreport/shared";

import type { ForeignGridRow } from "./slide-grid-foreign";
import {
  buildOwnDecisionRow,
  buildOwnItemRow,
  buildOwnRiskRow,
  collapseAuthorSeries,
  type GridAuthor,
  type GridColumnKey,
  type GridColumns,
  type GridRow,
  hasText,
  sortCellRows,
} from "./slide-grid-rows";

export interface CellBuckets {
  readonly current: readonly GridRow[];
  readonly next: readonly GridRow[];
  readonly risks: readonly GridRow[];
  readonly decisions: readonly GridRow[];
}

export const emptyBuckets = (): CellBuckets => ({
  current: [],
  next: [],
  risks: [],
  decisions: [],
});

/** An activity subsection lives under its single linked product; zero or
 * multiple links place it on the Shared context card (no duplication). */
export function activityHomeProduct(
  linkedProducts: readonly { readonly productId: string }[],
  knownProductIds: ReadonlySet<string>,
  sharedCardId: string,
): string {
  const [only, ...rest] = linkedProducts;
  if (only === undefined || rest.length > 0) return sharedCardId;
  return knownProductIds.has(only.productId) ? only.productId : sharedCardId;
}

export interface CollectedCells {
  readonly productLevel: ReadonlyMap<string, CellBuckets>;
  readonly activityCells: ReadonlyMap<string, CellBuckets>;
}

/** Where a single row lands: the product-level map keyed by product id (or the
 * shared card), or the per-activity map keyed by activity id. An activity
 * parent always wins over a product parent — mirrors the pre-refactor
 * `bucketFor(productId, activityId)` routing. */
interface RowPlacement {
  readonly scope: "product" | "activity";
  readonly key: string;
  readonly column: GridColumnKey;
  readonly row: GridRow;
}

function placeAt(
  productKey: string,
  activityId: string | null | undefined,
  column: GridColumnKey,
  row: GridRow,
): RowPlacement {
  return activityId == null
    ? { scope: "product", key: productKey, column, row }
    : { scope: "activity", key: activityId, column, row };
}

/** Immutably appends `row` to `key`'s bucket in `map`, creating the bucket (and
 * the map entry) on first use. */
function withRow(
  map: ReadonlyMap<string, CellBuckets>,
  key: string,
  column: GridColumnKey,
  row: GridRow,
): ReadonlyMap<string, CellBuckets> {
  const bucket = map.get(key) ?? emptyBuckets();
  return new Map(map).set(key, {
    ...bucket,
    [column]: [...bucket[column], row],
  });
}

function placeRow(acc: CollectedCells, next: RowPlacement): CollectedCells {
  return next.scope === "product"
    ? {
        ...acc,
        productLevel: withRow(
          acc.productLevel,
          next.key,
          next.column,
          next.row,
        ),
      }
    : {
        ...acc,
        activityCells: withRow(
          acc.activityCells,
          next.key,
          next.column,
          next.row,
        ),
      };
}

type ResolveProductKey = (productId: string | null | undefined) => string;

function ownItemPlacements(
  section: ReportSectionReadModel,
  owner: GridAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.items
    .filter((item) => hasText(item.text))
    .map((item, index) =>
      placeAt(
        resolveProductKey(item.projectId),
        item.activityId,
        item.type === "current" ? "current" : "next",
        buildOwnItemRow(item, owner, index),
      ),
    );
}

function ownRiskPlacements(
  section: ReportSectionReadModel,
  owner: GridAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.risks
    .filter((risk) => hasText(risk.risk))
    .map((risk, index) =>
      placeAt(
        resolveProductKey(risk.projectId),
        risk.activityId,
        "risks",
        buildOwnRiskRow(risk, owner, index),
      ),
    );
}

function ownDecisionPlacements(
  section: ReportSectionReadModel,
  owner: GridAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.decisions
    .filter((decision) => hasText(decision.text))
    .map((decision, index) =>
      placeAt(
        resolveProductKey(decision.productId),
        decision.activityId,
        "decisions",
        buildOwnDecisionRow(decision, owner, index),
      ),
    );
}

/** Foreign rows never carry an activity parent and only land on products the
 * deck already shows — unknown-product rows are dropped, never folded to the
 * shared card. */
function foreignPlacements(
  foreignRows: readonly ForeignGridRow[],
  knownProductIds: ReadonlySet<string>,
): readonly RowPlacement[] {
  return foreignRows
    .filter(({ productId }) => knownProductIds.has(productId))
    .map(({ row, productId, column }) => ({
      scope: "product" as const,
      key: productId,
      column,
      row,
    }));
}

/** Distribute own + foreign rows into per-product product-level buckets and
 * per-activity buckets. Rows on unknown products fold into the shared card;
 * foreign rows land only on products the deck already shows. */
export function collectCells(input: {
  readonly section: ReportSectionReadModel;
  readonly owner: GridAuthor;
  readonly foreignRows: readonly ForeignGridRow[];
  readonly knownProductIds: ReadonlySet<string>;
  readonly sharedCardId: string;
}): CollectedCells {
  const { section, owner, foreignRows, knownProductIds, sharedCardId } = input;
  const resolveProductKey: ResolveProductKey = (productId) =>
    productId != null && knownProductIds.has(productId)
      ? productId
      : sharedCardId;

  const placements = [
    ...ownItemPlacements(section, owner, resolveProductKey),
    ...ownRiskPlacements(section, owner, resolveProductKey),
    ...ownDecisionPlacements(section, owner, resolveProductKey),
    ...foreignPlacements(foreignRows, knownProductIds),
  ];

  return placements.reduce<CollectedCells>(placeRow, {
    productLevel: new Map(),
    activityCells: new Map(),
  });
}

export function finalizeColumns(
  cells: CellBuckets,
  authorOrder: ReadonlyMap<string, number>,
): GridColumns {
  const finalize = (rows: readonly GridRow[]): readonly GridRow[] =>
    collapseAuthorSeries(sortCellRows(rows, authorOrder));
  return {
    current: finalize(cells.current),
    next: finalize(cells.next),
    risks: finalize(cells.risks),
    decisions: finalize(cells.decisions),
  };
}

export function columnsRowCount(columns: GridColumns): number {
  return (
    columns.current.length +
    columns.next.length +
    columns.risks.length +
    columns.decisions.length
  );
}
