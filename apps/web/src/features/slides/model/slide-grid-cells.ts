import type { ReportSectionReadModel } from "@customreport/shared";

import type { ForeignGridRow } from "./slide-grid-foreign";
import {
  buildOwnDecisionRow,
  buildOwnItemRow,
  buildOwnRiskRow,
  collapseAuthorSeries,
  type GridAuthor,
  type GridColumns,
  type GridRow,
  sortCellRows,
} from "./slide-grid-rows";

export interface CellBuckets {
  readonly current: GridRow[];
  readonly next: GridRow[];
  readonly risks: GridRow[];
  readonly decisions: GridRow[];
}

export const emptyBuckets = (): CellBuckets => ({
  current: [],
  next: [],
  risks: [],
  decisions: [],
});

function hasText(text: string | null | undefined): text is string {
  return typeof text === "string" && text.trim().length > 0;
}

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
  const productLevel = new Map<string, CellBuckets>();
  const activityCells = new Map<string, CellBuckets>();
  const productBucket = (productId: string | null | undefined): CellBuckets => {
    const key =
      productId != null && knownProductIds.has(productId)
        ? productId
        : sharedCardId;
    const existing = productLevel.get(key) ?? emptyBuckets();
    productLevel.set(key, existing);
    return existing;
  };
  const bucketFor = (
    productId: string | null | undefined,
    activityId: string | null | undefined,
  ): CellBuckets => {
    if (activityId == null) return productBucket(productId);
    const existing = activityCells.get(activityId) ?? emptyBuckets();
    activityCells.set(activityId, existing);
    return existing;
  };

  section.items
    .filter((item) => hasText(item.text))
    .forEach((item, index) => {
      const cells = bucketFor(item.projectId, item.activityId);
      const rows = item.type === "current" ? cells.current : cells.next;
      rows.push(buildOwnItemRow(item, owner, index));
    });
  section.risks
    .filter((risk) => hasText(risk.risk))
    .forEach((risk, index) => {
      bucketFor(risk.projectId, risk.activityId).risks.push(
        buildOwnRiskRow(risk, owner, index),
      );
    });
  section.decisions
    .filter((decision) => hasText(decision.text))
    .forEach((decision, index) => {
      bucketFor(decision.productId, decision.activityId).decisions.push(
        buildOwnDecisionRow(decision, owner, index),
      );
    });
  for (const { row, productId, column } of foreignRows) {
    if (!knownProductIds.has(productId)) continue;
    productBucket(productId)[column].push(row);
  }
  return { productLevel, activityCells };
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
