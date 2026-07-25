import type { Prisma, PrismaClient } from "@prisma/client";

// Guarded predicate + zero-row disambiguation for manual publish only.
// Injected client/data keep the caller's transaction and snapshot write strategy.
// Spec: openspec/specs/publish-compare-and-set/spec.md

// Structural so both a $transaction client and base PrismaService satisfy it.
export interface PublishCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

// transitioned | raced (concurrent publish won) | archived (fail closed).
export type PublishCasOutcome = "transitioned" | "raced" | "archived";

// Predicate closes concurrent-publish and archive↔publish races; zero-row re-read
// through the SAME client splits raced vs archived. data applied verbatim in updateMany.
/**
 * Publish Compare And Set.
 * @param client - The client argument.
 * @param reportId - The reportId argument.
 * @param data - The data argument.
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
