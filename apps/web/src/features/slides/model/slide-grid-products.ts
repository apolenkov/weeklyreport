import type { ReportSectionReadModel } from "@customreport/shared";

import { activityDisplayTitle } from "../../../shared/lib/activity/activity-display";
import {
  type CellBuckets,
  columnsRowCount,
  emptyBuckets,
  finalizeColumns,
} from "./slide-grid-cells";
import type { GridColumns, SlideTrafficStatus } from "./slide-grid-rows";

export interface GridSubsection {
  // Product-level records and one activity use the same four-column rendering.
  readonly kind: "product-level" | "project";
  readonly id: string;
  readonly name: string;
  // Weekly Activity description; empty descriptions do not render a row.
  readonly note: string | null;
  readonly linkedProducts: ReportSectionReadModel["activities"][number]["linkedProducts"];
  // Activity status; product-level subsections carry none.
  readonly status: SlideTrafficStatus;
  // Activity records cannot carry stages by schema rule.
  readonly showStages: boolean;
  readonly columns: GridColumns;
}

export interface GridProductCard {
  readonly id: string;
  readonly name: string;
  readonly status: SlideTrafficStatus;
  // True when the product has neither updates nor a derived status this period.
  readonly noData: boolean;
  readonly subsections: readonly GridSubsection[];
}

interface BuildProductSubsectionsInput {
  readonly section: ReportSectionReadModel;
  readonly productLevel: ReadonlyMap<string, CellBuckets>;
  readonly activityCells: ReadonlyMap<string, CellBuckets>;
  readonly activityHomeById: ReadonlyMap<string, string>;
  readonly authorOrder: ReadonlyMap<string, number>;
  readonly sharedCardId: string;
}

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
          name: meta ? activityDisplayTitle(meta) : "Activity",
          note: meta?.note ?? null,
          linkedProducts: meta?.linkedProducts ?? [],
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
        note: null,
        linkedProducts: [],
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
  // Real products feed worstStatus/onTrack; Shared is excluded.
  readonly realCards: readonly GridProductCard[];
  // Full display list, optionally including Shared when it has content.
  readonly products: readonly GridProductCard[];
}

// A card with zero rows and no status-only project subsection collapses away;
// the pseudo Shared card follows the real products.
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
    const status = productStatuses.get(id) ?? null;
    const rowCount = subsections.reduce(
      (sum, subsection) => sum + columnsRowCount(subsection.columns),
      0,
    );
    return {
      id,
      name,
      status,
      // A product or activity status is a current-period signal even without updates.
      noData:
        status === null &&
        rowCount === 0 &&
        !subsections.some((s) => s.kind === "project"),
      subsections,
    };
  };
  const realCards = realProducts.map((p) => toCard(p.projectId, p.projectName));
  const sharedCard = toCard(sharedCardId, sharedCardName);
  const products = sharedCard.noData ? realCards : [...realCards, sharedCard];
  return { realCards, products };
}
