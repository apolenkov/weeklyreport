import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  type LeadFormRepository,
} from "../domain/lead-form-shared";
import { ReportSectionDomainError } from "./report-sections.service.js";

type Section = NonNullable<
  Awaited<ReturnType<LeadFormRepository["getSectionById"]>>
>;

export async function assertFillableTarget(
  repository: LeadFormRepository,
  targetSectionId: string,
  userId: string,
): Promise<Section> {
  const target = await repository.getSectionById(targetSectionId);
  if (!target) {
    throw new LeadFormDomainError(
      `Target section ${targetSectionId} not found.`,
    );
  }
  if (target.authorId !== userId) {
    throw new LeadFormAccessError("Can only fill your own section.");
  }
  if (target.status === "submitted") {
    throw new LeadFormConstraintError("Cannot fill a submitted section.");
  }
  return target;
}

// Resolve-not-delete binds Fill From: delete-recreating items/decisions would
// silently destroy published-lineage records on a REOPENED period. Fail closed
// when the target holds any lineage; a never-published draft has none.
export async function assertNoPublishedLineage(
  repository: LeadFormRepository,
  target: Parameters<LeadFormRepository["getPublishedLineage"]>[0],
): Promise<void> {
  const published = await repository.getPublishedLineage(target);
  if (
    published.itemStableIds.length > 0 ||
    published.decisionStableIds.length > 0
  ) {
    throw new ReportSectionDomainError(
      "PUBLISHED_RECORD_LOCKED",
      "Fill from previous cannot replace records that are part of the published report.",
    );
  }
}

// Authorize the SOURCE section: the picker only offers the lead's OWN past
// sections, so a foreign sourceSectionId is a forged request — without this a
// lead could copy another group's content into their own draft. Never cross-author.
export async function assertFillableSource(
  repository: LeadFormRepository,
  sourceSectionId: string,
  userId: string,
): Promise<void> {
  const source = await repository.getSectionById(sourceSectionId);
  if (!source) {
    throw new LeadFormDomainError(
      `Source section ${sourceSectionId} not found.`,
    );
  }
  if (source.authorId !== userId) {
    throw new LeadFormAccessError("Can only fill from your own section.");
  }
}
