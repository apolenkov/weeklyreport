import type { Prisma } from "@prisma/client";
import {
  type IncompleteRecordDeletion,
  isCompleteDecision,
  isCompleteRisk,
} from "@weeklyreport/shared";

import { ReportSectionDomainError } from "../application/report-sections.service";
import {
  findIncompleteRecordViolation,
  type ReplacementRecords,
} from "../domain/incomplete-record-guard.js";

/**
 * Rejects a whole-collection replacement that would erase a stored incomplete
 * risk or decision without an explicit deletion. Callers: the section save
 * (`applySaveSection`) and Fill From (`fillFromSectionTx`) — every writer that
 * clears a section's risks and decisions. Each calls it after its version
 * compare-and-set, so the rows are that writer's to judge and a rejection
 * rolls the version bump back with everything else.
 */
export async function assertIncompleteRecordsReleased(
  tx: Prisma.TransactionClient,
  sectionId: string,
  replacement: ReplacementRecords,
  deletions: readonly IncompleteRecordDeletion[],
): Promise<void> {
  const where = { reportSectionId: sectionId };
  const risks = await tx.risk.findMany({
    where,
    select: { stableId: true, impact: true, mitigation: true },
  });
  const decisions = await tx.decision.findMany({
    where,
    select: { stableId: true, impact: true },
  });
  const violation = findIncompleteRecordViolation(
    [
      ...risks.map((risk) => ({
        kind: "risk" as const,
        stableId: risk.stableId,
        complete: isCompleteRisk(risk),
      })),
      ...decisions.map((decision) => ({
        kind: "decision" as const,
        stableId: decision.stableId,
        complete: isCompleteDecision(decision),
      })),
    ],
    replacement,
    deletions,
  );
  if (violation) {
    throw new ReportSectionDomainError(violation.code, violation.message);
  }
}
