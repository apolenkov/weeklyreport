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

/** A subsection plus the id of the product card it belongs under. */
interface HomedSubsection {
  readonly home: string;
  readonly subsection: GridSubsection;
}

type ActivityMeta = ReportSectionReadModel["activities"][number];

function buildActivityEntries(
  input: BuildProductSubsectionsInput,
  activityMeta: ReadonlyMap<string, ActivityMeta>,
): readonly HomedSubsection[] {
  const {
    section,
    activityCells,
    activityHomeById,
    authorOrder,
    sharedCardId,
  } = input;
  const recordOnlyActivityIds = [...activityCells.keys()].filter(
    (activityId) => !activityMeta.has(activityId),
  );
  return [
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
    .sort((a, b) => a.subsection.name.localeCompare(b.subsection.name));
}

// Status-only activities still render as empty labeled rows (not a separate pill
// lane). Snapshot-drift activity ids missing from section.activities still get
// a generically titled subsection.
/**
 * Build Product Subsections.
 * @param input - The input argument.
 */
export function buildProductSubsections(
  input: BuildProductSubsectionsInput,
): ReadonlyMap<string, readonly GridSubsection[]> {
  const { section, productLevel, authorOrder } = input;
  const activityMeta = new Map(
    section.activities.map((activity) => [activity.activityId, activity]),
  );

  const productLevelEntries: readonly HomedSubsection[] = [...productLevel].map(
    ([productId, cells]) => ({
      home: productId,
      subsection: {
        kind: "product-level" as const,
        id: `${productId}-product-level`,
        name: "Product-level",
        status: null,
        showStages: true,
        columns: finalizeColumns(cells, authorOrder),
      },
    }),
  );

  // Product-level first, then activities: card order follows insertion order.
  return [
    ...productLevelEntries,
    ...buildActivityEntries(input, activityMeta),
  ].reduce<ReadonlyMap<string, readonly GridSubsection[]>>(
    (acc, { home, subsection }) =>
      new Map(acc).set(home, [...(acc.get(home) ?? []), subsection]),
    new Map<string, readonly GridSubsection[]>(),
  );
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
 * collapsing a card with zero rows and no status-only project subsection.  * @param input - The input argument.
 */
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
