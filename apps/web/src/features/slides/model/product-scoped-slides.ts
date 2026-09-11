import type { ReportSectionReadModel } from "@customreport/shared";

import {
  accumulateProductSections,
  type ProductAccumulator,
} from "./product-scope/product-scoped-accumulator";
import { SHARED_PRODUCT_ID } from "./product-scoped-activity-home";
import type { SectionSlideModel } from "./section-slide-contracts";
import { buildSectionSlideModel } from "./section-slide-model";
import { buildSlideRecordAttribution } from "./slide-record-attribution";

function toProductSlide(
  accumulator: ProductAccumulator,
  reportId: string,
): SectionSlideModel {
  const section: ReportSectionReadModel = {
    reportSectionId: `product-${accumulator.projectId}`,
    reportId,
    authorId: accumulator.projectId,
    authorName: accumulator.projectName,
    authorRole: "lead",
    version: 1,
    status:
      accumulator.anySubmitted && accumulator.allSubmitted
        ? "submitted"
        : "draft",
    submittedAt: accumulator.latestSubmittedAt,
    late: false,
    projects:
      accumulator.projectId === SHARED_PRODUCT_ID
        ? []
        : [
            {
              projectId: accumulator.projectId,
              projectName: accumulator.projectName,
              trafficLight: accumulator.trafficLight,
              ownedStages: [...accumulator.ownedStages.values()],
              stageSet: [...accumulator.ownedStages.values()],
              ownerGroupId: null,
            },
          ],
    referencedProjects: [],
    items: [...accumulator.items],
    risks: [...accumulator.risks],
    decisions: [...accumulator.decisions],
    activities: [...accumulator.activities],
    reviews: [],
  };
  const model = buildSectionSlideModel(section, {
    recordAttribution: buildSlideRecordAttribution(accumulator.sourceSections),
  });
  return {
    ...model,
    ownerName: accumulator.projectName,
    ownerRole: "product",
    products:
      accumulator.contributors.length > 0
        ? [...accumulator.contributors]
        : model.products,
  };
}

export function buildProductScopedSlides(
  sections: readonly ReportSectionReadModel[],
): SectionSlideModel[] {
  const products = accumulateProductSections(sections);
  const reportId = sections[0]?.reportId ?? SHARED_PRODUCT_ID;
  return [...products.values()].map((product) =>
    toProductSlide(product, reportId),
  );
}
