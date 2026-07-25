import type { ReportSectionReadModel } from "@customreport/shared";

import { worstTrafficStatus } from "../../../lib/status-presentation";
import type { CrossAuthorContentRow } from "../../report-sections";
import { buildAuthorRoster } from "./slide-grid-authors";
import { activityHomeProduct, collectCells } from "./slide-grid-cells";
import { buildForeignRows } from "./slide-grid-foreign";
import {
  buildPriorityStrip,
  type GridPriorityCard,
} from "./slide-grid-priority";
import {
  type GridAuthor,
  type GridColumns,
  type SlideTrafficStatus,
  sortStageNames,
} from "./slide-grid-rows";
import {
  buildProductSubsections,
  deriveProductCards,
} from "./slide-grid-subsections";

export type { GridPriorityCard } from "./slide-grid-priority";
export type {
  GridAuthor,
  GridColumnKey,
  GridRow,
  GridRowEditableRef,
  GridTone,
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
  // First occurrence wins, so a duplicated product keeps the entry the rest of
  // the model already references. Section product lists are a handful of rows.
  return projects.filter(
    (project, index) =>
      projects.findIndex(
        (candidate) => candidate.projectId === project.projectId,
      ) === index,
  );
}

interface ProductLookup {
  readonly realProducts: ReportSectionReadModel["projects"];
  readonly knownProductIds: ReadonlySet<string>;
  readonly productNameById: ReadonlyMap<string, string>;
}

function deriveProductLookup(section: ReportSectionReadModel): ProductLookup {
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
  return { realProducts, knownProductIds, productNameById };
}

function buildActivityHomeById(
  section: ReportSectionReadModel,
  knownProductIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  return new Map(
    section.activities.map((activity) => [
      activity.activityId,
      activityHomeProduct(
        activity.linkedProducts,
        knownProductIds,
        SHARED_CARD_ID,
      ),
    ]),
  );
}

type HeaderSummary = Pick<
  SlideGridModel,
  "counters" | "onTrack" | "worstStatus"
>;

/** "N of M products on track" and the header counters/worst-status chip —
 * always derived from real product cards, never the pseudo Shared card. */
function buildHeaderSummary(
  realCards: readonly GridProductCard[],
  products: readonly GridProductCard[],
  priorityStrip: readonly GridPriorityCard[],
): HeaderSummary {
  const scored = realCards.filter(
    (card) => !card.noData && card.status != null,
  );
  const allColumns = products.flatMap((card) =>
    card.subsections.map((subsection) => subsection.columns),
  );
  return {
    worstStatus: worstTrafficStatus(realCards.map((card) => card.status)),
    counters: {
      current: allColumns.reduce((sum, c) => sum + c.current.length, 0),
      risks: allColumns.reduce((sum, c) => sum + c.risks.length, 0),
      priorities: priorityStrip.length,
    },
    onTrack: {
      on: scored.filter((card) => card.status === "green").length,
      total: scored.length,
    },
  };
}

// Own rows carry the section author; Everyone-mode foreign rows keep real author identity.
export function buildSlideGridModel(input: SlideGridInput): SlideGridModel {
  const { section, foreign = [] } = input;
  const productStatuses =
    input.productStatuses ?? new Map<string, SlideTrafficStatus>();

  const roster = buildAuthorRoster(section, foreign);
  const authorOrder = new Map(
    roster.authors.map((author, index) => [author.id, index]),
  );
  const { realProducts, knownProductIds, productNameById } =
    deriveProductLookup(section);

  const { productLevel, activityCells } = collectCells({
    section,
    owner: roster.owner,
    foreignRows: buildForeignRows(foreign),
    knownProductIds,
    sharedCardId: SHARED_CARD_ID,
  });
  const activityHomeById = buildActivityHomeById(section, knownProductIds);

  const subsectionsByProduct = buildProductSubsections({
    section,
    productLevel,
    activityCells,
    activityHomeById,
    authorOrder,
    sharedCardId: SHARED_CARD_ID,
  });
  const { realCards, products } = deriveProductCards({
    realProducts,
    subsectionsByProduct,
    productStatuses,
    sharedCardId: SHARED_CARD_ID,
    sharedCardName: SHARED_CARD_NAME,
  });

  const priorityStrip = buildPriorityStrip({
    section,
    knownProductIds,
    productNameById,
    activityHomeById,
    sharedCardId: SHARED_CARD_ID,
    sharedCardName: SHARED_CARD_NAME,
  });

  return {
    authors: roster.authors,
    priorityStrip,
    products,
    ...buildHeaderSummary(realCards, products, priorityStrip),
  };
}

/** Unique stage names present on the slide, in canonical pipeline order —
 * feeds the footer stage legend. */
export function collectStageNames(model: SlideGridModel): readonly string[] {
  const names = model.products
    .flatMap((card) => card.subsections)
    .flatMap((subsection) => [
      ...subsection.columns.current,
      ...subsection.columns.next,
      ...subsection.columns.risks,
      ...subsection.columns.decisions,
    ])
    .flatMap((row) => row.stageNames);
  return sortStageNames([...new Set(names)]);
}
