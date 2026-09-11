import type {
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared.js";
import {
  assertLatestOutcomeSource,
  resolveEligibleOutcomeSourceSection,
} from "./item-outcome-source-freshness.js";

const PRIOR_UNAVAILABLE = "The prior plan is not available.";

export async function resolveOutcomeSource(
  tx: Prisma.TransactionClient,
  target: ReportSectionReadModel,
  command: ResolvePlanInput,
) {
  if (command.source.kind === "current") {
    const item = target.items.find(
      (candidate) => candidate.id === command.source.recordId,
    );
    if (!item?.stableId)
      throw new LeadFormDomainError(
        "The plan is no longer available. Reload the report.",
      );
    return item;
  }
  const currentPeriod = await tx.report.findUnique({
    where: { id: target.reportId },
    select: { periodStart: true },
  });
  if (!currentPeriod)
    throw new LeadFormDomainError("The report is not available.");
  // The report lock also serializes submitted-source revocation and publication.
  // The status-graph lock was already acquired before locking the target.
  await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${command.source.reportId} FOR UPDATE`;
  const prior = await tx.report.findFirst({
    where: {
      id: command.source.reportId,
      periodStart: { lt: currentPeriod.periodStart },
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      status: true,
      periodStatus: true,
      publishedSnapshot: true,
      publishedSectionScopes: {
        where: { authorId: target.authorId },
        select: { authorId: true, reportSectionId: true, groupId: true },
      },
    },
  });
  if (!prior) throw new LeadFormDomainError(PRIOR_UNAVAILABLE);
  const section = await resolveEligibleOutcomeSourceSection(
    tx,
    prior,
    target.authorId,
  );
  if (!section) throw new LeadFormDomainError(PRIOR_UNAVAILABLE);
  const item = section.items.find(
    (candidate) => candidate.id === command.source.recordId,
  );
  if (!item?.stableId) throw new LeadFormDomainError(PRIOR_UNAVAILABLE);
  if (target.items.some((candidate) => candidate.stableId === item.stableId)) {
    throw new LeadFormConstraintError(
      "This plan already has a current occurrence. Update that occurrence instead.",
    );
  }
  await assertLatestOutcomeSource(tx, {
    source: prior,
    targetPeriodStart: currentPeriod.periodStart,
    authorId: target.authorId,
    stableId: item.stableId,
  });
  return item;
}
