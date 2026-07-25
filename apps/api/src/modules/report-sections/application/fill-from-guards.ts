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

/**
 * Assert Fillable Target.
 * @param repository - The repository argument.
 * @param targetSectionId - The targetSectionId argument.
 * @param userId - The userId argument.
 */
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

/**
 * Resolve-not-delete also binds Fill From: it delete-recreates the target's
 * items/decisions with fresh identity, which would silently destroy any
 * published-lineage record on a REOPENED period (the caller's periodStatus gate
 * only blocks a still-published one). Fail closed — reject the whole fill if the
 * target holds any published-lineage record; a never-published draft has none
 * and is unaffected. The same lineage query the save guard uses.
 * @param repository - The repository argument.
 * @param target - The target argument.
 */
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

/**
 * Authorize the SOURCE section. The fill-from picker only ever offers the lead's
 * OWN past sections (`LeadReportPeriod.sourceSectionId` is sourced from
 * `MyHistoryEntry.sectionId`), so any sourceSectionId authored by someone else
 * is a forged request — without this guard a lead could copy another group's
 * Item/Risk/Decision content into their own draft on an open report. fillFrom
 * copies your own history; it is never cross-author.
 * @param repository - The repository argument.
 * @param sourceSectionId - The sourceSectionId argument.
 * @param userId - The userId argument.
 */
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
