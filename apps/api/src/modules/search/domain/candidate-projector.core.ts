import type { ReportSectionReadModel } from "@customreport/shared";

import type {
  CandidateContext,
  CandidateIdentity,
  ReportOccurrence,
  SearchCandidate,
  SectionScope,
} from "./report-retrieval.types.js";

type ProductSubject = Readonly<{
  kind: "product";
  id: string;
  name: string;
}>;
type ActivitySubject = Readonly<{
  kind: "activity";
  id: string;
  name: string;
}>;
export type Subject = ProductSubject | ActivitySubject;

export class CandidateProjectionAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateProjectionAccessError";
  }
}

const productNames = (
  section: ReportSectionReadModel,
): ReadonlyMap<string, string> =>
  new Map([
    ...section.referencedProjects.map(
      (project) => [project.projectId, project.projectName] as const,
    ),
    ...section.projects.map(
      (project) => [project.projectId, project.projectName] as const,
    ),
  ]);

const activityNames = (
  section: ReportSectionReadModel,
): ReadonlyMap<string, string> =>
  new Map(
    section.activities.map(
      (activity) => [activity.activityId, activity.activityName] as const,
    ),
  );

export const candidateContext = (
  occurrence: ReportOccurrence,
  section: ReportSectionReadModel,
  subject: Subject,
  stageIds: readonly string[],
): CandidateContext => ({
  reportId: occurrence.reportId,
  periodId: occurrence.periodId,
  periodLabel: occurrence.periodLabel,
  periodStart: occurrence.periodStart,
  source: occurrence.source,
  sectionId: section.reportSectionId,
  authorId: section.authorId,
  authorName: section.authorName,
  subject,
  stageIds,
  linkedProductIds:
    subject.kind === "activity"
      ? (section.activities
          .find((activity) => activity.activityId === subject.id)
          ?.linkedProducts.map((product) => product.productId) ?? [])
      : [],
});

export const candidateIdentity = (
  occurrence: ReportOccurrence,
  section: ReportSectionReadModel,
  kind: SearchCandidate["kind"],
  {
    recordId,
    lineageId,
  }: Readonly<{
    recordId: string;
    lineageId?: string | undefined;
  }>,
): CandidateIdentity => ({
  occurrenceId: `${occurrence.reportId}:${section.reportSectionId}:${kind}:${recordId}`,
  recordId,
  lineageId: lineageId ?? null,
});

export const recordSubject = (
  section: ReportSectionReadModel,
  record: Readonly<{
    projectId?: string | null | undefined;
    productId?: string | null | undefined;
    activityId?: string | null | undefined;
  }>,
): Subject | null => {
  const names = productNames(section);
  const activities = activityNames(section);
  if (record.activityId != null) {
    const name = activities.get(record.activityId);
    return name ? { kind: "activity", id: record.activityId, name } : null;
  }
  const productId = record.projectId ?? record.productId;
  if (productId != null) {
    const name = names.get(productId);
    return name ? { kind: "product", id: productId, name } : null;
  }
  return null;
};

const hasPrivateForeignFields = (section: ReportSectionReadModel): boolean =>
  section.activities.length > 0 ||
  section.reviews.length > 0 ||
  section.items.some((item) => "comments" in item || "pausedReason" in item) ||
  section.risks.some((risk) => "comments" in risk) ||
  section.decisions.some((decision) => "comments" in decision);

const foreignSectionIsFiltered = (section: ReportSectionReadModel): boolean => {
  const productIds = new Set([
    ...section.projects.map((project) => project.projectId),
    ...section.referencedProjects.map((project) => project.projectId),
  ]);
  const hasUnscopedRecord = [
    ...section.items.map((item) => item.projectId),
    ...section.risks.map((risk) => risk.projectId),
    ...section.decisions.map((decision) => decision.productId),
  ].some((productId) => productId == null || !productIds.has(productId));
  return !hasPrivateForeignFields(section) && !hasUnscopedRecord;
};

export const assertProjectableScope = (
  occurrence: ReportOccurrence,
  scope: SectionScope,
): void => {
  const section = scope.section;
  if (
    occurrence.reportId !== scope.reportId ||
    section.reportId !== scope.reportId ||
    section.reportSectionId !== scope.sectionId ||
    section.authorId !== scope.authorId
  ) {
    throw new CandidateProjectionAccessError(
      "Candidate scope does not match its report occurrence.",
    );
  }
  if (
    scope.visibility === "shared_products" &&
    !foreignSectionIsFiltered(section)
  ) {
    throw new CandidateProjectionAccessError(
      "Foreign candidate scope must use the shared-product lens.",
    );
  }
};
