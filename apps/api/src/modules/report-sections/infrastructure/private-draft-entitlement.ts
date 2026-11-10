import type { Prisma } from "@prisma/client";
import { AUTHORING_ROLES } from "@weeklyreport/shared";

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
