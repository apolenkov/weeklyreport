import type { ReportSectionReadModel } from "@customreport/shared";

import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import type { CrossAuthorContentRow } from "../../report-sections";
import { buildAuthorRoster } from "./slide-grid-authors";
import { activityHomeProduct, collectCells } from "./slide-grid-cells";
import { buildForeignRows } from "./slide-grid-foreign";
import {
  buildPriorityStrip,
  type GridPriorityCard,
} from "./slide-grid-priority";
import {
  buildProductSubsections,
  deriveProductCards,
  type GridProductCard,
} from "./slide-grid-products";
import {
  type GridAuthor,
  type SlideTrafficStatus,
  sortStageNames,
} from "./slide-grid-rows";

export type { GridPriorityCard } from "./slide-grid-priority";
export type {
  GridAuthor,
  GridColumnKey,
  GridRow,
  GridRowEditableRef,
  GridTone,
  SlideTrafficStatus,
} from "./slide-grid-rows";

// Shared is a pseudo-card for cross-product content; product scoping excludes
// this id from product chips.
export const SHARED_CARD_ID = "cross-product";
export const SHARED_CARD_NAME = "Shared context";

export interface SlideGridModel {
  // Legend order is owner first, then foreign authors by name.
  readonly authors: readonly GridAuthor[];
  // Mine already identifies the selected owner in the slide header.
  readonly showOwnerMarks: boolean;
  readonly worstStatus: SlideTrafficStatus;
  readonly counters: {
    readonly current: number;
    readonly risks: number;
    readonly priorities: number;
  };
  // On-track counts only real product cards with data and a status.
  readonly onTrack: { readonly on: number; readonly total: number };
  readonly priorityStrip: readonly GridPriorityCard[];
  readonly products: readonly GridProductCard[];
}

export interface SlideGridInput {
  readonly section: ReportSectionReadModel;
  // Optional server/model-computed risk floors for product statuses.
  readonly productStatuses?: ReadonlyMap<string, SlideTrafficStatus>;
  // Everyone-mode rows retain co-owner identity; they are never anonymized.
  readonly foreign?: readonly CrossAuthorContentRow[];
  // Mine already names the selected owner in the slide header.
  readonly showOwnerBadges?: boolean;
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
    ...section.referencedProjects.map(
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

// Header counts and worst status use real product cards, never the Shared card.
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
    ...(input.showOwnerBadges === false
      ? { hiddenAuthorId: roster.owner.id }
      : {}),
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
    showOwnerMarks: input.showOwnerBadges !== false,
    priorityStrip,
    products,
    ...buildHeaderSummary(realCards, products, priorityStrip),
  };
}

// Unique stage names present on the slide, in canonical pipeline order —
// feeds the footer stage legend.
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
