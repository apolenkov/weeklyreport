import type { ReportSectionReadModel } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections";
import type {
  SectionSlideModel,
  SlideActivityPill,
} from "./section-slide-contracts";
import { applyForeignProductHealth } from "./section-slide-foreign";
import { buildSectionProductProjection } from "./section-slide-product-projection";
import { buildSectionSlideHealth } from "./section-slide-readiness";
import { buildSlideGridModel } from "./slide-grid-model";

interface BuildSectionSlideOptions {
  readonly foreign?: readonly CrossAuthorContentRow[];
  readonly foreignHealth?: Parameters<typeof applyForeignProductHealth>[1];
}

function projectActivities(
  section: ReportSectionReadModel,
): SlideActivityPill[] {
  return section.activities.map((activity) => ({
    id: activity.activityId,
    name: activity.activityName,
    status: activity.derivedStatus ?? activity.status,
    linkedProducts: activity.linkedProducts.map(
      (product) => product.productName,
    ),
  }));
}

export function buildSectionSlideModel(
  section: ReportSectionReadModel,
  options: BuildSectionSlideOptions = {},
): SectionSlideModel {
  const projection = buildSectionProductProjection(section);
  const productSlides =
    options.foreignHealth === undefined || options.foreignHealth.length === 0
      ? projection.productSlides
      : applyForeignProductHealth(
          projection.productSlides,
          options.foreignHealth,
        );
  const health = buildSectionSlideHealth(section, projection);
  const counts = {
    productCount: projection.products.length,
    currentCount: projection.currentItems.length,
    nextCount: projection.nextItems.length,
    riskCount: projection.risks.length,
    decisionCount: projection.decisions.length,
    priorityCount: projection.priorities.length,
  };
  return {
    id: section.reportSectionId,
    ownerId: section.authorId,
    ownerName: shortNameFromName(section.authorName),
    ownerRole: section.authorRole ?? "lead",
    status: section.status,
    submittedAt: section.submittedAt,
    products: projection.products,
    productSlides,
    ...counts,
    ...health,
    currentItems: projection.currentItems,
    nextItems: projection.nextItems,
    risks: projection.risks,
    decisions: projection.decisions,
    priorities: projection.priorities,
    activities: projectActivities(section),
    grid: buildSlideGridModel({
      section,
      productStatuses: new Map(
        productSlides.map((product) => [product.id, product.status]),
      ),
      ...(options.foreign === undefined ? {} : { foreign: options.foreign }),
    }),
  };
}
