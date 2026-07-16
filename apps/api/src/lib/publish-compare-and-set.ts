import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Shared publish compare-and-set for the manual-publish write path
 * (`PeriodPrismaRepository.publishPeriod`), homed here so the guarded
 * predicate and the zero-row disambiguation exist in exactly one place. This
 * owns ONLY the canonical predicate and the `count === 0` classification; the
 * client (transaction or base) and the caller's full `data` field set are
 * injected, so the caller keeps its own transaction context and its own
 * snapshot-write strategy. The scheduler auto-publish path
 * (`PublicationPrismaRepository.saveAutoPublishedReport`) has a different
 * predicate (`status: "draft"`, not periodStatus-keyed) and does not call this
 * helper.
 */

/**
 * The Prisma `report` surface the CAS needs. Structural so both a `$transaction`
 * client (`tx`) and the base `PrismaService` satisfy it.
 */
export interface PublishCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

/**
 * - `transitioned` — this call flipped the row to published.
 * - `raced` — a concurrent publish won first (idempotent success, no write).
 * - `archived` — the period was archived inside the read→write window (fail closed).
 */
export type PublishCasOutcome = "transitioned" | "raced" | "archived";

/**
 * Guarded compare-and-set for a manual publish. The predicate
 * `{ id, periodStatus: { not: "published" }, archived: false }` lets exactly one
 * of two concurrent publishes win; `archived: false` is the single point that
 * closes the archive↔publish race. On a zero-row match, a re-read through the
 * SAME client disambiguates raced (now published) from archived — so a caller
 * inside a `$transaction` re-reads transactionally and a caller without one
 * re-reads directly. `data` is applied verbatim inside the single guarded
 * `updateMany`, so a caller with no surrounding transaction can ride its
 * snapshot in that same statement.
 */
export async function publishCompareAndSet(
  client: PublishCasClient,
  reportId: string,
  data: Prisma.ReportUpdateManyMutationInput,
): Promise<PublishCasOutcome> {
  const { count } = await client.report.updateMany({
    where: {
      id: reportId,
      periodStatus: { not: "published" },
      archived: false,
    },
    data,
  });

  if (count === 0) {
    const current = await client.report.findUnique({
      where: { id: reportId },
      select: { periodStatus: true },
    });
    return current?.periodStatus === "published" ? "raced" : "archived";
  }

  return "transitioned";
}
