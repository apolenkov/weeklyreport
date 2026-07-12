import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Shared reopen compare-and-set, the reopen-leg sibling of
 * `publish-compare-and-set.ts`. Reopen and admin manual archive both mutate a
 * published `Report`; their service-layer state pre-checks are TOCTOU reads
 * that a concurrent archive can stale. This owns ONLY the guarded predicate and
 * the zero-row classification; the client (transaction or base) and the
 * caller's full `data` field set are injected, so the caller keeps its own
 * transaction context and sources the complete lifecycle write from
 * `buildTransition("reopen", …)`.
 */

/**
 * The Prisma `report` surface the CAS needs. Structural so both a `$transaction`
 * client (`tx`) and the base `PrismaService` satisfy it.
 */
export interface ReopenCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

/**
 * - `transitioned` — this call flipped the published row to reopened.
 * - `archived` — an archive landed inside the read→write window (fail closed).
 * - `notReopenable` — the row is no longer `periodStatus="published"` (already
 *   reopened, or otherwise moved off published) (fail closed).
 *
 * Every non-`transitioned` outcome is fail-closed: the caller MUST raise a
 * domain error and reset no sections. The split only tailors the message.
 */
export type ReopenCasOutcome = "transitioned" | "archived" | "notReopenable";

/**
 * Guarded compare-and-set for a head reopen. The predicate
 * `{ id, archived: false, periodStatus: "published" }` lets a reopen transition
 * only a still-published, non-archived row; `archived: false` and
 * `periodStatus: "published"` together are the single point that closes the
 * reopen-versus-archive race, so a period archived inside the read→write window
 * is never reopened. On a zero-row match, a re-read through the SAME client
 * splits an archive that won the row (`archived`) from a row that is simply no
 * longer published (`notReopenable`) — both fail closed. `data` is applied
 * verbatim inside the single guarded `updateMany`.
 */
export async function reopenCompareAndSet(
  client: ReopenCasClient,
  reportId: string,
  data: Prisma.ReportUpdateManyMutationInput,
): Promise<ReopenCasOutcome> {
  const { count } = await client.report.updateMany({
    where: {
      id: reportId,
      archived: false,
      periodStatus: "published",
    },
    data,
  });

  if (count === 0) {
    const current = await client.report.findUnique({
      where: { id: reportId },
      select: { archived: true },
    });
    return current?.archived ? "archived" : "notReopenable";
  }

  return "transitioned";
}
