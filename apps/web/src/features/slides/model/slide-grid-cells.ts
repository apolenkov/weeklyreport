import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type { ForeignGridRow } from "./slide-grid-foreign";
import {
  buildOwnDecisionRow,
  buildOwnItemRow,
  buildOwnRiskRow,
  type GridAuthor,
  type GridColumnKey,
  type GridColumns,
  type GridRow,
  hasText,
  sortCellRows,
} from "./slide-grid-rows";
import {
  attributedRecordAuthor,
  type SlideRecordAttribution,
  type SlideSourceRecord,
} from "./slide-record-attribution";

export type CellBuckets = GridColumns;

export const emptyBuckets = (): CellBuckets => ({
  current: [],
  next: [],
  risks: [],
  decisions: [],
});

// An activity with zero or multiple product links uses the Shared card; one
// known link gives it a single product home.
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

// Activity parents win over product parents; otherwise rows use the product or
// Shared-card key.
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

// Preserve first-seen keys and encounter order inside each column bucket.
function bucketsByKey(
  placements: readonly RowPlacement[],
): ReadonlyMap<string, CellBuckets> {
  return new Map(
    [...Map.groupBy(placements, (placement) => placement.key)].map(
      ([key, group]) => {
        const column = (col: GridColumnKey): readonly GridRow[] =>
          group.filter((p) => p.column === col).map((p) => p.row);
        return [
          key,
          {
            current: column("current"),
            next: column("next"),
            risks: column("risks"),
            decisions: column("decisions"),
          },
        ];
      },
    ),
  );
}

type ResolveProductKey = (productId: string | null | undefined) => string;
type ResolveAuthor = (record: SlideSourceRecord) => GridAuthor;

function ownItemPlacements(
  section: ReportSectionReadModel,
  owner: ResolveAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.items
    .filter((item) => hasText(item.text))
    .map((item, index) =>
      placeAt(
        resolveProductKey(item.projectId),
        item.activityId,
        item.type === "current" ? "current" : "next",
        buildOwnItemRow(item, owner(item), index),
      ),
    );
}

function ownRiskPlacements(
  section: ReportSectionReadModel,
  owner: ResolveAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.risks
    .filter((risk) => hasText(risk.risk))
    .map((risk, index) =>
      placeAt(
        resolveProductKey(risk.projectId),
        risk.activityId,
        "risks",
        buildOwnRiskRow(risk, owner(risk), index),
      ),
    );
}

function ownDecisionPlacements(
  section: ReportSectionReadModel,
  owner: ResolveAuthor,
  resolveProductKey: ResolveProductKey,
): readonly RowPlacement[] {
  return section.decisions
    .filter((decision) => hasText(decision.text))
    .map((decision, index) =>
      placeAt(
        resolveProductKey(decision.productId),
        decision.activityId,
        "decisions",
        buildOwnDecisionRow(decision, owner(decision), index),
      ),
    );
}

// Foreign rows stay on known product cards; unknown products are dropped rather
// than folded into Shared.
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

// Own unknown-product rows fold into Shared; foreign rows remain limited to
// products already present in the deck.
export function collectCells(input: {
  readonly recordAttribution?: SlideRecordAttribution | undefined;
  readonly section: ReportSectionReadModel;
  readonly owner: GridAuthor;
  readonly foreignRows: readonly ForeignGridRow[];
  readonly knownProductIds: ReadonlySet<string>;
  readonly sharedCardId: string;
}): CollectedCells {
  const { section, owner, foreignRows, knownProductIds, sharedCardId } = input;
  const recordOwner: ResolveAuthor = (record) =>
    input.recordAttribution
      ? attributedRecordAuthor(record, input.recordAttribution)
      : owner;
  const resolveProductKey: ResolveProductKey = (productId) =>
    productId != null && knownProductIds.has(productId)
      ? productId
      : sharedCardId;

  const placements = [
    ...ownItemPlacements(section, recordOwner, resolveProductKey),
    ...ownRiskPlacements(section, recordOwner, resolveProductKey),
    ...ownDecisionPlacements(section, recordOwner, resolveProductKey),
    ...foreignPlacements(foreignRows, knownProductIds),
  ];

  return {
    productLevel: bucketsByKey(placements.filter((p) => p.scope === "product")),
    activityCells: bucketsByKey(
      placements.filter((p) => p.scope === "activity"),
    ),
  };
}

export function finalizeColumns(
  cells: CellBuckets,
  authorOrder: ReadonlyMap<string, number>,
): GridColumns {
  const finalize = (rows: readonly GridRow[]): readonly GridRow[] =>
    sortCellRows(rows, authorOrder);
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
