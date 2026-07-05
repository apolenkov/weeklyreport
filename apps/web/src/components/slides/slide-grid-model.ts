import type { ReportSectionReadModel } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../lib/mappers/lead-cross-author";
import {
  activityHomeProduct,
  buildPriorityStrip,
  collectCells,
  columnsRowCount,
  finalizeColumns,
  type GridPriorityCard,
  hasText,
  worstOf,
} from "./slide-grid-cells";
import { buildForeignRows } from "./slide-grid-foreign";
import {
  buildAuthorRoster,
  type GridAuthor,
  type GridColumns,
  type SlideTrafficStatus,
} from "./slide-grid-rows";

export type { GridPriorityCard } from "./slide-grid-cells";
export type {
  GridAuthor,
  GridBadge,
  GridColumnKey,
  GridColumns,
  GridRow,
  SlideTrafficStatus,
} from "./slide-grid-rows";

/** Pseudo-card id for content that belongs to no single product. Matches the
 * deck's existing cross-product pseudo-entry id so product scoping (which
 * already excludes it from chips) keeps working unchanged. */
export const SHARED_CARD_ID = "cross-product";
export const SHARED_CARD_NAME = "Shared context";

export interface GridSubsection {
  /** "product-level" = records parented to the product itself; "project" = one
   * attached Project Activity's records. */
  readonly kind: "product-level" | "project";
  readonly id: string;
  readonly name: string;
  /** Project (activity) status dot; product-level subsections carry none. */
  readonly status: SlideTrafficStatus;
  /** Stage watermarks render only on product-level rows (activity records
   * cannot carry stages by schema rule). */
  readonly showStages: boolean;
  readonly columns: GridColumns;
}

export interface GridProductCard {
  readonly id: string;
  readonly name: string;
  readonly status: SlideTrafficStatus;
  /** True when the product has no records this period — renders collapsed. */
  readonly noData: boolean;
  readonly subsections: readonly GridSubsection[];
}

export interface SlideGridModel {
  /** Legend roster: section author first, foreign authors after (name order). */
  readonly authors: readonly GridAuthor[];
  readonly worstStatus: SlideTrafficStatus;
  readonly counters: {
    readonly current: number;
    readonly risks: number;
    readonly priorities: number;
  };
  /** "N of M products on track" — real product cards with data and a status. */
  readonly onTrack: { readonly on: number; readonly total: number };
  readonly priorityStrip: readonly GridPriorityCard[];
  readonly products: readonly GridProductCard[];
}

export interface SlideGridInput {
  readonly section: ReportSectionReadModel;
  /** Risk-floored product statuses computed by `buildSectionSlideModel`. */
  readonly productStatuses?: ReadonlyMap<string, SlideTrafficStatus>;
  /** Everyone-mode co-owner rows (with author identity — never anonymized). */
  readonly foreign?: readonly CrossAuthorContentRow[];
}

function uniqueProducts(
  projects: ReportSectionReadModel["projects"],
): ReportSectionReadModel["projects"] {
  const seen = new Set<string>();
  return projects.filter((project) => {
    if (seen.has(project.projectId)) return false;
    seen.add(project.projectId);
    return true;
  });
}

/**
 * Pure view model for the by-product slide grid: products → (product-level +
 * per-activity subsections) → four sorted, author-collapsed record columns,
 * plus header stats, priority strip, and the legend roster. Own rows carry the
 * section author; Everyone-mode foreign rows keep their real author identity.
 */
export function buildSlideGridModel(input: SlideGridInput): SlideGridModel {
  const { section, foreign = [] } = input;
  const productStatuses =
    input.productStatuses ?? new Map<string, SlideTrafficStatus>();

  const roster = buildAuthorRoster(section, foreign);
  const authorOrder = new Map(
    roster.authors.map((author, index) => [author.id, index]),
  );

  const realProducts = uniqueProducts(section.projects);
  const knownProductIds = new Set(realProducts.map((p) => p.projectId));
  const productNameById = new Map<string, string>([
    ...realProducts.map(
      (p) => [p.projectId, p.projectName] as readonly [string, string],
    ),
    [SHARED_CARD_ID, SHARED_CARD_NAME],
    ...(section.referencedProjects ?? []).map(
      (p) => [p.projectId, p.projectName] as readonly [string, string],
    ),
  ]);

  const { productLevel, activityCells } = collectCells({
    section,
    owner: roster.owner,
    foreignRows: buildForeignRows(foreign),
    knownProductIds,
    sharedCardId: SHARED_CARD_ID,
  });

  const activityHomeById = new Map(
    section.activities.map((activity) => [
      activity.activityId,
      activityHomeProduct(
        activity.linkedProducts,
        knownProductIds,
        SHARED_CARD_ID,
      ),
    ]),
  );
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
  [...activityCells.entries()]
    .map(([activityId, cells]) => {
      const meta = activityMeta.get(activityId);
      return {
        home: activityHomeById.get(activityId) ?? SHARED_CARD_ID,
        subsection: {
          kind: "project" as const,
          id: activityId,
          name: meta?.activityName ?? "Activity",
          status: meta ? (meta.derivedStatus ?? meta.status) : null,
          showStages: false,
          columns: finalizeColumns(cells, authorOrder),
        },
      };
    })
    .sort((a, b) => a.subsection.name.localeCompare(b.subsection.name))
    .forEach(({ home, subsection }) => {
      addSubsection(home, subsection);
    });

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
      noData: rowCount === 0,
      subsections,
    };
  };
  const realCards = realProducts.map((p) => toCard(p.projectId, p.projectName));
  const sharedCard = toCard(SHARED_CARD_ID, SHARED_CARD_NAME);
  const products = sharedCard.noData ? realCards : [...realCards, sharedCard];

  const scored = realCards.filter(
    (card) => !card.noData && card.status != null,
  );
  const allColumns = products.flatMap((card) =>
    card.subsections.map((subsection) => subsection.columns),
  );
  const priorityStrip = buildPriorityStrip({
    section,
    productNameById,
    activityHomeById,
    sharedCardId: SHARED_CARD_ID,
    sharedCardName: SHARED_CARD_NAME,
  });
  return {
    authors: roster.authors,
    worstStatus: worstOf(realCards.map((card) => card.status)),
    counters: {
      current: allColumns.reduce((sum, c) => sum + c.current.length, 0),
      risks: allColumns.reduce((sum, c) => sum + c.risks.length, 0),
      priorities: priorityStrip.length,
    },
    onTrack: {
      on: scored.filter((card) => card.status === "green").length,
      total: scored.length,
    },
    priorityStrip,
    products,
  };
}

/** Guard used by tests and the article: `hasText` re-export for fixtures. */
export { hasText };
