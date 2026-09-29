import type { Prisma, PrismaClient } from "@prisma/client";

import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import type { LifecycleWrite } from "../domain/period-transition.js";
import { reportLifecycleCasWhere } from "./report-lifecycle-cas.js";

// Guarded predicate + zero-row disambiguation for manual publish only.
// Injected client/data keep the caller's transaction and snapshot write strategy.
// Spec: openspec/specs/publish-compare-and-set/spec.md

// Structural so both a $transaction client and base PrismaService satisfy it.
export interface PublishCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

// transitioned | raced (concurrent publish won) | fail-closed outcomes.
export type PublishCasOutcome = "transitioned" | "raced" | "archived" | "stale";

// Predicate closes concurrent-publish and archive↔publish races; zero-row re-read
// through the SAME client splits raced vs archived. data applied verbatim in updateMany.
export async function publishCompareAndSet(
  client: PublishCasClient,
  reportId: string,
  expected: PeriodLifecycleExpectation,
  data: LifecycleWrite & Prisma.ReportUpdateManyMutationInput,
): Promise<PublishCasOutcome> {
  if (expected.archived) return "archived";
  if (expected.periodStatus === "published") return "raced";

  const { count } = await client.report.updateMany({
    where: reportLifecycleCasWhere(reportId, expected),
    data,
  });

  if (count === 0) {
    const current = await client.report.findUnique({
      where: { id: reportId },
      select: { archived: true, periodStatus: true },
    });
    if (current?.archived) return "archived";
    if (current?.periodStatus === "published") return "raced";
    return "stale";
  }

  return "transitioned";
}
