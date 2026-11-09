import type { Prisma } from "@prisma/client";
import type { Role } from "@weeklyreport/shared";

/**
 * Roles that may author report content. Mirrors the content-write gate
 * (openspec/specs/report-section-write-gates): a viewer may still own a
 * section after demotion, but no longer reads its private drafts.
 */
export const AUTHORING_ROLES = [
  "lead",
  "head",
  "admin",
] as const satisfies readonly Role[];

/**
 * The one private-draft entitlement: the actor is the section's exact author
 * and is, in the database right now, active and in an authoring role. A
 * session's cached role or section pointer never substitutes for this filter,
 * and leadership or shared-product scope does not satisfy it.
 */
export function privateDraftOwnerWhere(
  actorId: string,
): Prisma.ReportSectionWhereInput {
  return {
    authorId: actorId,
    author: { isActive: true, role: { in: [...AUTHORING_ROLES] } },
  };
}
