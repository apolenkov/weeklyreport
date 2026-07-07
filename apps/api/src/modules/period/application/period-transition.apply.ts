import type { Prisma, PrismaClient, Report } from "@prisma/client";

import {
  buildTransition,
  type TransitionCtx,
  type TransitionKind,
} from "../domain/period-transition.js";

/**
 * refactor-period-transition-writer: the thin applicator that runs a
 * {@link buildTransition} field set against the database.
 *
 * `applyTransition` accepts the CALLER's transaction client and never opens its
 * own. This is deliberate: `publishPeriod` builds and writes the published
 * snapshot from the updated row inside the same `$transaction`, so the state
 * write and the snapshot write must share one transaction. (`publishPeriod`
 * needs a snapshot `include` on the same `update` call, so it calls
 * `tx.report.update({ data: buildTransition(...) })` directly rather than this
 * helper — still sourcing every lifecycle value from the module.)
 *
 * The `create` transition is NOT applied here — it is a `report.create` that
 * also needs the non-governed identity envelope, so its caller spreads
 * `buildTransition("create", ctx)` into its own create.
 */
export function applyTransition<K extends TransitionKind>(
  tx: Prisma.TransactionClient,
  reportId: string,
  kind: K,
  ctx: TransitionCtx[K],
): Promise<Report> {
  return tx.report.update({
    where: { id: reportId },
    data: buildTransition(kind, ctx),
  });
}

/**
 * Convenience wrapper for callers that have no transaction of their own: opens
 * a single-statement `$transaction` around {@link applyTransition}.
 */
export function runTransition<K extends TransitionKind>(
  prisma: PrismaClient,
  reportId: string,
  kind: K,
  ctx: TransitionCtx[K],
): Promise<Report> {
  return prisma.$transaction((tx) => applyTransition(tx, reportId, kind, ctx));
}
