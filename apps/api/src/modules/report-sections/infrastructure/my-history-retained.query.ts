import type { Prisma } from "@prisma/client";
import {
  isCompleteDecision,
  isCompleteRisk,
  type RetainedDraftCounts,
} from "@weeklyreport/shared";

import { recoveryReadOnlyReason } from "../domain/retained-recovery.js";
import { privateDraftOwnerWhere } from "./private-draft-entitlement.js";
import { queryCurrentFormReportId } from "./retained-incomplete-records.query.js";

/**
 * Counts the unfinished risks and decisions the given own sections hold now,
 * keyed by section id, for history's recovery link. It answers only for
 * sections the actor authors while active in an authoring role, and only
 * where the recovery read would show them, so history never links to a
 * recovery that answers `unavailable`. Read-only: a section whose live rows
 * are gone (a restored snapshot) simply has no entry.
 */
export async function queryRetainedDraftCounts(
  prisma: Prisma.TransactionClient,
  actorId: string,
  sectionIds: readonly string[],
): Promise<ReadonlyMap<string, RetainedDraftCounts>> {
  if (sectionIds.length === 0) return new Map();
  const sources = await prisma.reportSection.findMany({
    where: { id: { in: [...sectionIds] }, ...privateDraftOwnerWhere(actorId) },
    select: {
      id: true,
      reportId: true,
      report: { select: { status: true, periodStatus: true, archived: true } },
      risks: { select: { impact: true, mitigation: true } },
      decisions: { select: { impact: true } },
    },
  });
  const drafted = sources.flatMap((source) => {
    const risks = source.risks.filter((risk) => !isCompleteRisk(risk)).length;
    const decisions = source.decisions.filter(
      (decision) => !isCompleteDecision(decision),
    ).length;
    return risks + decisions > 0 ? [{ source, risks, decisions }] : [];
  });
  if (drafted.length === 0) return new Map();

  const currentFormReportId = await queryCurrentFormReportId(prisma);
  return new Map(
    drafted.flatMap(({ source, risks, decisions }) => {
      const readOnlyReason = recoveryReadOnlyReason(
        source.report,
        source.reportId === currentFormReportId,
      );
      return readOnlyReason
        ? [[source.id, { risks, decisions, readOnlyReason }] as const]
        : [];
    }),
  );
}

/** Adds each history row's current retained counts, where it has any. */
export async function withRetainedDrafts<T extends { readonly id: string }>(
  prisma: Prisma.TransactionClient,
  actorId: string,
  rows: readonly T[],
): Promise<(T & { readonly retainedDrafts?: RetainedDraftCounts })[]> {
  const retained = await queryRetainedDraftCounts(
    prisma,
    actorId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const retainedDrafts = retained.get(row.id);
    return retainedDrafts ? { ...row, retainedDrafts } : row;
  });
}
