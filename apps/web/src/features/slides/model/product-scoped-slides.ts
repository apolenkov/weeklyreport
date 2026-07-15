import type { ReportSectionReadModel } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import type {
  SectionSlideModel,
  SlideStageStatus,
} from "./section-slide-contracts";
import { buildSectionSlideModel } from "./section-slide-model";
import { worstTraffic } from "./section-slide-model-helpers";

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];
type OwnedStage = NonNullable<
  ReportSectionReadModel["projects"][number]["ownedStages"]
>[number];

type ProductMap = ReadonlyMap<string, ProductAccumulator>;

interface ProductAccumulator {
  readonly projectId: string;
  readonly projectName: string;
  readonly trafficLight: SlideStageStatus;
  readonly ownedStages: ReadonlyMap<string, OwnedStage>;
  readonly items: readonly SectionItem[];
  readonly risks: readonly SectionRisk[];
  readonly decisions: readonly SectionDecision[];
  readonly contributors: readonly string[];
  readonly contributorNames: ReadonlySet<string>;
  readonly sectionIds: ReadonlySet<string>;
  readonly anySubmitted: boolean;
  readonly allSubmitted: boolean;
  readonly latestSubmittedAt: Date | null;
}

export const CROSS_PRODUCT_LABEL = "Shared context";
const SHARED_PRODUCT_ID = "shared-context";

function createAccumulator(
  projectId: string,
  projectName: string,
): ProductAccumulator {
  return {
    projectId,
    projectName,
    trafficLight: null,
    ownedStages: new Map(),
    items: [],
    risks: [],
    decisions: [],
    contributors: [],
    contributorNames: new Set(),
    sectionIds: new Set(),
    anySubmitted: false,
    allSubmitted: true,
    latestSubmittedAt: null,
  };
}

function registerContribution(
  accumulator: ProductAccumulator,
  section: ReportSectionReadModel,
): ProductAccumulator {
  if (accumulator.sectionIds.has(section.reportSectionId)) return accumulator;
  const submitted = section.status === "submitted";
  const addContributor = !accumulator.contributorNames.has(section.authorName);
  const latestSubmittedAt =
    submitted &&
    section.submittedAt &&
    (!accumulator.latestSubmittedAt ||
      section.submittedAt > accumulator.latestSubmittedAt)
      ? section.submittedAt
      : accumulator.latestSubmittedAt;
  return {
    ...accumulator,
    contributors: addContributor
      ? [...accumulator.contributors, shortNameFromName(section.authorName)]
      : accumulator.contributors,
    contributorNames: addContributor
      ? new Set([...accumulator.contributorNames, section.authorName])
      : accumulator.contributorNames,
    sectionIds: new Set([...accumulator.sectionIds, section.reportSectionId]),
    anySubmitted: accumulator.anySubmitted || submitted,
    allSubmitted: accumulator.allSubmitted && submitted,
    latestSubmittedAt,
  };
}

function updateProduct(
  products: ProductMap,
  projectId: string,
  projectName: string,
  update: (accumulator: ProductAccumulator) => ProductAccumulator,
): ProductMap {
  const current =
    products.get(projectId) ?? createAccumulator(projectId, projectName);
  return new Map([...products, [projectId, update(current)]]);
}

function mergeOwnedStages(
  existing: ReadonlyMap<string, OwnedStage>,
  stages: readonly OwnedStage[],
): ReadonlyMap<string, OwnedStage> {
  return stages.reduce<ReadonlyMap<string, OwnedStage>>((merged, stage) => {
    const previous = merged.get(stage.stageId);
    const value = previous
      ? {
          ...previous,
          status: worstTraffic(previous.status ?? null, stage.status ?? null),
        }
      : stage;
    return new Map([...merged, [stage.stageId, value]]);
  }, existing);
}

function addProject(
  products: ProductMap,
  project: ReportSectionReadModel["projects"][number],
  section: ReportSectionReadModel,
): ProductMap {
  return updateProduct(
    products,
    project.projectId,
    project.projectName,
    (accumulator) =>
      registerContribution(
        {
          ...accumulator,
          trafficLight: worstTraffic(
            accumulator.trafficLight,
            project.trafficLight,
          ),
          ownedStages: mergeOwnedStages(
            accumulator.ownedStages,
            project.ownedStages ?? [],
          ),
        },
        section,
      ),
  );
}

function appendRecord<Row>(
  products: ProductMap,
  identity: { readonly id: string; readonly name: string },
  section: ReportSectionReadModel,
  field: "items" | "risks" | "decisions",
  row: Row,
): ProductMap {
  return updateProduct(products, identity.id, identity.name, (accumulator) =>
    registerContribution(
      { ...accumulator, [field]: [...accumulator[field], row] },
      section,
    ),
  );
}

function addSection(products: ProductMap, section: ReportSectionReadModel) {
  const ownedProducts = new Map(
    section.projects.map((project) => [project.projectId, project.projectName]),
  );
  const identityFor = (productId: string | null | undefined) =>
    productId && ownedProducts.has(productId)
      ? { id: productId, name: ownedProducts.get(productId) ?? productId }
      : { id: SHARED_PRODUCT_ID, name: CROSS_PRODUCT_LABEL };
  const withProjects = section.projects.reduce(
    (result, project) => addProject(result, project, section),
    products,
  );
  const withItems = section.items.reduce(
    (result, item) =>
      appendRecord(result, identityFor(item.projectId), section, "items", item),
    withProjects,
  );
  const withRisks = section.risks.reduce(
    (result, risk) =>
      appendRecord(result, identityFor(risk.projectId), section, "risks", risk),
    withItems,
  );
  return section.decisions.reduce(
    (result, decision) =>
      appendRecord(
        result,
        identityFor(decision.productId),
        section,
        "decisions",
        decision,
      ),
    withRisks,
  );
}

function toProductSlide(
  accumulator: ProductAccumulator,
  reportId: string,
): SectionSlideModel {
  const section: ReportSectionReadModel = {
    reportSectionId: `product-${accumulator.projectId}`,
    reportId,
    authorId: accumulator.projectId,
    authorName: accumulator.projectName,
    version: 1,
    status:
      accumulator.anySubmitted && accumulator.allSubmitted
        ? "submitted"
        : "draft",
    submittedAt: accumulator.latestSubmittedAt,
    projects: [
      {
        projectId: accumulator.projectId,
        projectName: accumulator.projectName,
        trafficLight: accumulator.trafficLight,
        ownedStages: [...accumulator.ownedStages.values()],
      },
    ],
    items: [...accumulator.items],
    risks: [...accumulator.risks],
    decisions: [...accumulator.decisions],
    activities: [],
  };
  const model = buildSectionSlideModel(section);
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
  const products = sections.reduce<ProductMap>(addSection, new Map());
  const reportId = sections[0]?.reportId ?? SHARED_PRODUCT_ID;
  return [...products.values()].map((product) =>
    toProductSlide(product, reportId),
  );
}
