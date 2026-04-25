/**
 * Lead-status mapper: derives the display LeadStatus from API data.
 *
 * The API has only TWO ReportSectionStatus values (draft, submitted),
 * but the UI exposes THREE LeadStatus values (submitted, draft, pending).
 *
 * 'pending' is a computed presentation-only state with no Prisma/Zod
 * equivalent: it represents a draft section that exists but has no
 * items yet -- a lead who has not started filling in their report.
 */

export type ReportSectionStatus = 'draft' | 'submitted';
export type LeadStatus = 'submitted' | 'draft' | 'pending';

/**
 * Derives the display LeadStatus from the section's stored status and
 * its current item count.
 *
 * Rules:
 * - sectionStatus === 'submitted' -> 'submitted' (terminal state, item count irrelevant)
 * - sectionStatus === 'draft' && itemCount > 0 -> 'draft' (work has started)
 * - sectionStatus === 'draft' && itemCount === 0 -> 'pending' (computed)
 */
export function deriveLeadStatus(context: {
  sectionStatus: ReportSectionStatus;
  itemCount: number;
}): LeadStatus {
  if (context.sectionStatus === 'submitted') {
    return 'submitted';
  }
  // Draft section: 'pending' if no items yet, 'draft' if work has started.
  return context.itemCount > 0 ? 'draft' : 'pending';
}
