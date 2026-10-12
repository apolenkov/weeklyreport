import { aggregateTrafficLight } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections";
import type {
  SectionSlideModel,
  SlideProduct,
  SlideStageStatus,
} from "./section-slide-contracts";
import { nonEmpty, statusTone } from "./section-slide-model-helpers";

interface ForeignTextRow {
  readonly projectId: string;
  readonly text: string;
}

interface ForeignAlarmRow extends ForeignTextRow {
  readonly blocked: boolean;
}

export interface SlideForeignContent {
  readonly currentItems: readonly ForeignTextRow[];
  readonly nextItems: readonly ForeignTextRow[];
  readonly risks: readonly ForeignAlarmRow[];
  readonly decisions: readonly ForeignTextRow[];
}

export function applyForeignProductHealth(
  productSlides: readonly SlideProduct[],
  crossAuthors: readonly {
    projectId: string;
    stages: readonly { status: SlideStageStatus }[];
  }[],
): SlideProduct[] {
  if (crossAuthors.length === 0) return [...productSlides];
  return productSlides.map((product) => {
    const foreignWorst = aggregateTrafficLight(
      crossAuthors
        .filter((crossAuthor) => crossAuthor.projectId === product.id)
        .flatMap((crossAuthor) => crossAuthor.stages)
        .map((stage) => stage.status),
    );
    return {
      ...product,
      status: aggregateTrafficLight([product.status, foreignWorst]),
    };
  });
}

export function crossAuthorContentToSlideForeign(
  rows: readonly CrossAuthorContentRow[],
): SlideForeignContent {
  const items = rows.flatMap((crossAuthor) => crossAuthor.items);
  const mapItem = (item: (typeof items)[number]): ForeignTextRow => ({
    projectId: item.projectId,
    text: item.text,
  });
  return {
    currentItems: items.filter((item) => item.type === "current").map(mapItem),
    nextItems: items.filter((item) => item.type === "next").map(mapItem),
    risks: rows.flatMap((crossAuthor) =>
      crossAuthor.risks.map((risk) => ({
        projectId: risk.projectId,
        text: risk.risk,
        blocked: risk.severity === "blocked",
      })),
    ),
    decisions: rows.flatMap((crossAuthor) =>
      crossAuthor.decisions.map((decision) => ({
        projectId: decision.productId,
        text: decision.text,
      })),
    ),
  };
}

function landedForeignContent(
  model: SectionSlideModel,
  foreign: SlideForeignContent,
): SlideForeignContent {
  const productIds = new Set(model.productSlides.map((product) => product.id));
  const landed = <Row extends ForeignTextRow>(rows: readonly Row[]): Row[] =>
    rows.filter((row) => productIds.has(row.projectId) && nonEmpty(row.text));
  return {
    currentItems: landed(foreign.currentItems),
    nextItems: landed(foreign.nextItems),
    risks: landed(foreign.risks),
    decisions: landed(foreign.decisions),
  };
}

function mergeProductContent(
  products: readonly SlideProduct[],
  foreign: SlideForeignContent,
): SlideProduct[] {
  const textFor = (rows: readonly ForeignTextRow[], productId: string) =>
    rows
      .filter((row) => row.projectId === productId)
      .map((row) => row.text.trim());
  return products.map((product) => {
    const currentItems = textFor(foreign.currentItems, product.id);
    const nextItems = textFor(foreign.nextItems, product.id);
    const risks = textFor(foreign.risks, product.id);
    const decisions = textFor(foreign.decisions, product.id);
    const foreignCount =
      currentItems.length + nextItems.length + risks.length + decisions.length;
    return foreignCount === 0
      ? product
      : {
          ...product,
          currentItems: [...product.currentItems, ...currentItems],
          nextItems: [...product.nextItems, ...nextItems],
          risks: [...product.risks, ...risks],
          decisions: [...product.decisions, ...decisions],
        };
  });
}

function foreignCounts(model: SectionSlideModel, foreign: SlideForeignContent) {
  const blockedAdd = foreign.risks.filter((row) => row.blocked).length;
  return {
    currentCount: model.currentCount + foreign.currentItems.length,
    nextCount: model.nextCount + foreign.nextItems.length,
    riskCount: model.riskCount + foreign.risks.length,
    priorityCount: model.priorityCount,
    blockedCount: model.blockedCount + blockedAdd,
    atRiskCount:
      model.atRiskCount + foreign.risks.filter((row) => !row.blocked).length,
  };
}

export function mergeForeignSlideContent(
  model: SectionSlideModel,
  foreign: SlideForeignContent,
): SectionSlideModel {
  const landed = landedForeignContent(model, foreign);
  const landedCount =
    landed.currentItems.length +
    landed.nextItems.length +
    landed.risks.length +
    landed.decisions.length;
  if (landedCount === 0) return model;
  const counts = foreignCounts(model, landed);
  const trimText = (rows: readonly ForeignTextRow[]) =>
    rows.map((row) => row.text.trim());
  return {
    ...model,
    productSlides: mergeProductContent(model.productSlides, landed),
    currentItems: [...model.currentItems, ...trimText(landed.currentItems)],
    nextItems: [...model.nextItems, ...trimText(landed.nextItems)],
    risks: [...model.risks, ...trimText(landed.risks)],
    decisions: [...model.decisions, ...trimText(landed.decisions)],
    currentCount: counts.currentCount,
    nextCount: counts.nextCount,
    riskCount: counts.riskCount,
    decisionCount: model.decisionCount + landed.decisions.length,
    blockedCount: counts.blockedCount,
    atRiskCount: counts.atRiskCount,
    tone: statusTone(counts),
  };
}
