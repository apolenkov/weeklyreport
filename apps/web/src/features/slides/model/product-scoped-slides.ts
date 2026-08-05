import type { ReportSectionReadModel } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import {
  buildActivityHomeById,
  CROSS_PRODUCT_LABEL,
  makeIdentityResolver,
  SHARED_PRODUCT_ID,
} from "./product-scoped-activity-home";
import type {
  SectionSlideModel,
  SlideStageStatus,
} from "./section-slide-contracts";
import { buildSectionSlideModel } from "./section-slide-model";

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];
type SectionActivity = ReportSectionReadModel["activities"][number];
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
  readonly activities: readonly SectionActivity[];
  readonly contributors: readonly string[];
  readonly contributorIds: ReadonlySet<string>;
  readonly sectionIds: ReadonlySet<string>;
  readonly anySubmitted: boolean;
  readonly allSubmitted: boolean;
  readonly latestSubmittedAt: Date | null;
}

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
    activities: [],
    contributors: [],
    contributorIds: new Set(),
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
  // Identity is the author id, not the display name — two distinct users
  // sharing a display name stay two contributors.
  const addContributor = !accumulator.contributorIds.has(section.authorId);
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
    contributorIds: addContributor
      ? new Set([...accumulator.contributorIds, section.authorId])
      : accumulator.contributorIds,
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
          status: worstTrafficStatus([previous.status, stage.status]),
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
          trafficLight: worstTrafficStatus([
            accumulator.trafficLight,
            project.trafficLight,
          ]),
          ownedStages: mergeOwnedStages(
            accumulator.ownedStages,
            project.ownedStages,
          ),
        },
        section,
      ),
  );
}

type SectionRecord = SectionItem | SectionRisk | SectionDecision;

function appendRecord(
  products: ProductMap,
  identity: { readonly id: string; readonly name: string },
  section: ReportSectionReadModel,
  field: "items" | "risks" | "decisions",
  row: SectionRecord,
): ProductMap {
  return updateProduct(products, identity.id, identity.name, (accumulator) =>
    registerContribution(
      { ...accumulator, [field]: [...accumulator[field], row] },
      section,
    ),
  );
}

// Rows home to their own product, an activity's linked product, or the
// shared card when neither resolves — see product-scoped-activity-home.
function accumulateActivities(
  products: ProductMap,
  section: ReportSectionReadModel,
  activityHomeById: ReadonlyMap<string, string>,
  ownedProducts: ReadonlyMap<string, string>,
): ProductMap {
  return [...section.activities].reduce((result, activity) => {
    const home = activityHomeById.get(activity.activityId) ?? SHARED_PRODUCT_ID;
    return updateProduct(
      result,
      home,
      ownedProducts.get(home) ?? CROSS_PRODUCT_LABEL,
      (accumulator) => ({
        ...accumulator,
        activities: [...accumulator.activities, activity],
      }),
    );
  }, products);
}

function addSection(products: ProductMap, section: ReportSectionReadModel) {
  const ownedProducts = new Map(
    section.projects.map((project) => [project.projectId, project.projectName]),
  );
  const knownProductIds = new Set(ownedProducts.keys());
  const activityHomeById = buildActivityHomeById(section, knownProductIds);
  const identityFor = makeIdentityResolver(ownedProducts, activityHomeById);
  const withProjects = section.projects.reduce(
    (result, project) => addProject(result, project, section),
    products,
  );
  const withItems = section.items.reduce(
    (result, item) =>
      appendRecord(
        result,
        identityFor(item.projectId, item.activityId),
        section,
        "items",
        item,
      ),
    withProjects,
  );
  const withRisks = section.risks.reduce(
    (result, risk) =>
      appendRecord(
        result,
        identityFor(risk.projectId, risk.activityId),
        section,
        "risks",
        risk,
      ),
    withItems,
  );
  const withActivities = accumulateActivities(
    withRisks,
    section,
    activityHomeById,
    ownedProducts,
  );
  return section.decisions.reduce(
    (result, decision) =>
      appendRecord(
        result,
        identityFor(decision.productId, decision.activityId),
        section,
        "decisions",
        decision,
      ),
    withActivities,
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
    authorRole: "lead",
    version: 1,
    status:
      accumulator.anySubmitted && accumulator.allSubmitted
        ? "submitted"
        : "draft",
    submittedAt: accumulator.latestSubmittedAt,
    late: false,
    projects: [
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
