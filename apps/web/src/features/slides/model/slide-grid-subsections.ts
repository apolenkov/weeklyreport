import type { ReportSectionReadModel } from "@customreport/shared";

import {
  type CellBuckets,
  columnsRowCount,
  emptyBuckets,
  finalizeColumns,
} from "./slide-grid-cells";
import type { GridProductCard, GridSubsection } from "./slide-grid-model";
import type { SlideTrafficStatus } from "./slide-grid-rows";

interface BuildProductSubsectionsInput {
  readonly section: ReportSectionReadModel;
  readonly productLevel: ReadonlyMap<string, CellBuckets>;
  readonly activityCells: ReadonlyMap<string, CellBuckets>;
  readonly activityHomeById: ReadonlyMap<string, string>;
  readonly authorOrder: ReadonlyMap<string, number>;
  readonly sharedCardId: string;
}

/** Product-level subsections (one per product with own/foreign rows) plus one
 * project subsection per attached activity — status-only activities (no
 * records this period) still render as a labeled header row with empty
 * columns, so they read like Product-level lines rather than a separate pill
 * lane. A record referencing an activity id absent from `section.activities`
 * (frozen snapshot drift) still gets a subsection, titled generically. */
export function buildProductSubsections(
  input: BuildProductSubsectionsInput,
): ReadonlyMap<string, readonly GridSubsection[]> {
  const {
    section,
    productLevel,
    activityCells,
    activityHomeById,
    authorOrder,
    sharedCardId,
  } = input;
  const activityMeta = new Map(
    section.activities.map((activity) => [activity.activityId, activity]),
  );

  const subsectionsByProduct = new Map<string, readonly GridSubsection[]>();
  const addSubsection = (productId: string, subsection: GridSubsection) => {
    const list = subsectionsByProduct.get(productId) ?? [];
    subsectionsByProduct.set(productId, [...list, subsection]);
  };

  for (const [productId, cells] of productLevel) {
    addSubsection(productId, {
      kind: "product-level",
      id: `${productId}-product-level`,
      name: "Product-level",
      status: null,
      showStages: true,
      columns: finalizeColumns(cells, authorOrder),
    });
  }

  const recordOnlyActivityIds = [...activityCells.keys()].filter(
    (activityId) => !activityMeta.has(activityId),
  );
  [
    ...section.activities.map((activity) => activity.activityId),
    ...recordOnlyActivityIds,
  ]
    .map((activityId) => {
      const meta = activityMeta.get(activityId);
      return {
        home: activityHomeById.get(activityId) ?? sharedCardId,
        subsection: {
          kind: "project" as const,
          id: activityId,
          name: meta?.activityName ?? "Activity",
          status: meta ? (meta.derivedStatus ?? meta.status) : null,
          showStages: false,
          columns: finalizeColumns(
            activityCells.get(activityId) ?? emptyBuckets(),
            authorOrder,
          ),
        },
      };
    })
    .sort((a, b) => a.subsection.name.localeCompare(b.subsection.name))
    .forEach(({ home, subsection }) => {
      addSubsection(home, subsection);
    });

  return subsectionsByProduct;
}

interface DeriveProductCardsInput {
  readonly realProducts: ReportSectionReadModel["projects"];
  readonly subsectionsByProduct: ReadonlyMap<string, readonly GridSubsection[]>;
  readonly productStatuses: ReadonlyMap<string, SlideTrafficStatus>;
  readonly sharedCardId: string;
  readonly sharedCardName: string;
}

interface ProductCards {
  /** Real products only — feeds worstStatus/onTrack, which never count the
   * pseudo Shared card. */
  readonly realCards: readonly GridProductCard[];
  /** realCards plus the Shared card, unless it collected no content. */
  readonly products: readonly GridProductCard[];
}

/** Builds each product's card (real products, then the pseudo Shared card),
 * collapsing a card with zero rows and no status-only project subsection. */
export function deriveProductCards(
  input: DeriveProductCardsInput,
): ProductCards {
  const {
    realProducts,
    subsectionsByProduct,
    productStatuses,
    sharedCardId,
    sharedCardName,
  } = input;
  const toCard = (id: string, name: string): GridProductCard => {
    const subsections = subsectionsByProduct.get(id) ?? [];
    const rowCount = subsections.reduce(
      (sum, subsection) => sum + columnsRowCount(subsection.columns),
      0,
    );
    return {
      id,
      name,
      status: productStatuses.get(id) ?? null,
      // A status-only project header is data: keep the card open for it.
      noData: rowCount === 0 && !subsections.some((s) => s.kind === "project"),
      subsections,
    };
  };
  const realCards = realProducts.map((p) => toCard(p.projectId, p.projectName));
  const sharedCard = toCard(sharedCardId, sharedCardName);
  const products = sharedCard.noData ? realCards : [...realCards, sharedCard];
  return { realCards, products };
}
