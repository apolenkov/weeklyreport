import type { Prisma, PrismaClient } from "@prisma/client";

import type { PeriodLifecycleExpectation } from "../modules/period/domain/period-lifecycle-expectation.js";
import type { LifecycleWrite } from "../modules/period/domain/period-transition.js";
import { reportLifecycleCasWhere } from "./report-lifecycle-cas.js";

// Guarded full-lifecycle-and-boundary predicate + zero-row classification for
// reopen. Injected client/data keep the caller's transaction and
// buildTransition lifecycle write.
// Spec: openspec/specs/reopen-compare-and-set/spec.md

// Structural so both a $transaction client and base PrismaService satisfy it.
export interface ReopenCasClient {
  readonly report: Pick<PrismaClient["report"], "updateMany" | "findUnique">;
}

// Non-transitioned outcomes are fail-closed; split only tailors the message.
export type ReopenCasOutcome =
  "transitioned" | "archived" | "notReopenable" | "stale";

// Predicate matches the complete expected lifecycle and reporting boundaries;
// zero-row re-read through the SAME client splits archive-won from other stale
// state. data is applied verbatim in updateMany.
export async function reopenCompareAndSet(
  client: ReopenCasClient,
  reportId: string,
  expected: PeriodLifecycleExpectation,
  data: LifecycleWrite & Prisma.ReportUpdateManyMutationInput,
): Promise<ReopenCasOutcome> {
  if (expected.archived) return "archived";
  if (expected.periodStatus !== "published") return "notReopenable";

  const { count } = await client.report.updateMany({
    where: reportLifecycleCasWhere(reportId, expected),
    data,
  });

  if (count === 0) {
    const current = await client.report.findUnique({
      where: { id: reportId },
      select: { archived: true, periodStatus: true },
    });
    if (!current) return "stale";
    if (current.archived) return "archived";
    if (current.periodStatus !== "published") return "notReopenable";
    return "stale";
  }

  return "transitioned";
}
