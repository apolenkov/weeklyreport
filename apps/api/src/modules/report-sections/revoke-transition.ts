import type { Prisma } from "@prisma/client";

/**
 * The single source of truth for the section un-submit transition
 * (`submitted → draft`, clear `submittedAt`, stamp the un-submitter). Shared by
 * the head's per-section revoke (`LeadFormPrismaRepository.revokeSectionSubmission`)
 * and a reviewer's `changes_requested` verdict (`ReviewPrismaRepository`), so
 * both apply the IDENTICAL write.
 *
 * Race-safety comes from the `status: "submitted"` guard in the `updateMany`
 * WHERE: whichever caller commits first flips the row; a concurrent second
 * caller (another verdict, or the head's revoke) matches zero rows and does NOT
 * re-stamp — the transition applies exactly once. `expectedVersion`, when
 * supplied, adds the `ReportSection.version` optimistic lock as belt-and-braces.
 *
 * It deliberately does NOT increment `version`: a verdict records
 * `judgedVersion = section.version`, and the returned draft must keep that
 * version so the verdict reads CURRENT ("needs changes") until the lead edits
 * or re-submits (which bumps version via `saveSection` and auto-stales it).
 *
 * Accepts either the full `PrismaClient`/`PrismaService` or a `$transaction`
 * client so the caller can compose it atomically with sibling writes (the
 * verdict upsert). Returns the number of rows transitioned (0 or 1).
 */
export async function applyRevokeTransition(
  tx: Pick<Prisma.TransactionClient, "reportSection">,
  sectionId: string,
  revokedBy: string,
  expectedVersion?: number,
): Promise<number> {
  const result = await tx.reportSection.updateMany({
    where: {
      id: sectionId,
      status: "submitted",
      ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
    },
    data: {
      status: "draft",
      revokedAt: new Date(),
      revokedBy,
      submittedAt: null,
    },
  });
  return result.count;
}
