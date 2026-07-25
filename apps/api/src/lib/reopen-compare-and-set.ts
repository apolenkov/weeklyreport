import type { Prisma, PrismaClient } from "@prisma/client";

// Guarded predicate + zero-row classification for reopen (and admin manual archive).
// Injected client/data keep the caller's transaction and buildTransition lifecycle write.
// Spec: openspec/specs/reopen-compare-and-set/spec.md

// Structural so both a $transaction client and base PrismaService satisfy it.
export interface ReopenCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

// Non-transitioned outcomes are fail-closed; split only tailors the message.
export type ReopenCasOutcome = "transitioned" | "archived" | "notReopenable";

// Predicate requires still-published + non-archived; zero-row re-read through the
// SAME client splits archive-won vs no-longer-published. data applied in updateMany.
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
