import {
  type LeadStatusOverviewOutput,
  leadStatusOverviewOutputSchema,
  reportSectionReadModelSchema,
  type Role,
  sharedReportSectionReadModelSchema,
} from "@customreport/shared";

import type { ByPeriodRequest } from "../domain/lead-form-cross-author-scope.js";
import {
  LeadFormDomainError,
  type LeadFormRepository,
} from "../domain/lead-form-shared.js";
import { readByPeriod } from "./lead-form-by-period.js";

/**
 * Deep read module for the compact Overview. Selected-section authorization,
 * predecessor authority, lifecycle eligibility, and output validation stay
 * behind this one interface.
 */
export async function readStatusOverview(
  repository: LeadFormRepository,
  request: ByPeriodRequest & { readonly role: Role },
): Promise<LeadStatusOverviewOutput> {
  const { reportId, userId: viewerId, role, requestedAuthorId } = request;
  const selected = await readByPeriod(repository, request);
  const periods = await repository.getStatusOverviewPeriods(
    reportId,
    selected.section.authorId,
    viewerId,
    role,
  );
  if (!periods) {
    throw new LeadFormDomainError(`Report ${reportId} not found.`);
  }

  const usesSharedLeadLens =
    role === "lead" &&
    requestedAuthorId !== undefined &&
    requestedAuthorId !== viewerId;
  const currentSection = usesSharedLeadLens
    ? sharedReportSectionReadModelSchema.parse(selected.section)
    : reportSectionReadModelSchema.parse(selected.section);

  return leadStatusOverviewOutputSchema.parse({
    current: { ...periods.current, section: currentSection },
    predecessor: periods.predecessor,
  });
}
