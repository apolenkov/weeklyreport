import {
  type LeadStatusOverviewOutput,
  leadStatusOverviewOutputSchema,
  type Role,
} from "@customreport/shared";

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
  reportId: string,
  viewerId: string,
  role: Role,
  requestedAuthorId?: string,
): Promise<LeadStatusOverviewOutput> {
  const selected = await readByPeriod(
    repository,
    reportId,
    viewerId,
    role,
    requestedAuthorId,
  );
  const periods = await repository.getStatusOverviewPeriods(
    reportId,
    selected.section.authorId,
    viewerId,
    role,
  );
  if (!periods) {
    throw new LeadFormDomainError(`Report ${reportId} not found.`);
  }

  return leadStatusOverviewOutputSchema.parse({
    current: { ...periods.current, section: selected.section },
    predecessor: periods.predecessor,
  });
}
