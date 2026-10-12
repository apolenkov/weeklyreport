import { Prisma } from "@prisma/client";
import type { ResolvePlanInput } from "@weeklyreport/shared";

import type { resolveItemTransition } from "../domain/item-outcome-transition.js";
import type { outcomeCandidate } from "./item-outcome.transaction.js";

type WriteArgs = Readonly<{
  sectionId: string;
  requestHash: string;
  actor: Readonly<{ id: string; name: string }>;
  stableId: string;
  transition: ReturnType<typeof resolveItemTransition>;
  candidate: ReturnType<typeof outcomeCandidate>;
}>;

function createOutcomeEvent(
  tx: Prisma.TransactionClient,
  command: ResolvePlanInput,
  { sectionId, requestHash, actor, stableId, transition }: WriteArgs,
) {
  return tx.itemOutcomeEvent.create({
    data: {
      id: command.commandId,
      reportSectionId: sectionId,
      stableId,
      requestHash,
      outcome: command.outcome,
      reason: command.reason ?? null,
      actorId: actor.id,
      actorName: actor.name,
      sourceReportId:
        command.source.kind === "prior" ? command.source.reportId : null,
      beforeState: transition.beforeState,
      afterState: transition.afterState,
    },
  });
}

export async function writeResolvedOutcome(
  tx: Prisma.TransactionClient,
  command: ResolvePlanInput,
  args: WriteArgs,
): Promise<void> {
  const { sectionId, stableId, transition, candidate } = args;
  const event = await createOutcomeEvent(tx, command, args);
  const resolution =
    command.outcome === "wont_do"
      ? {
          kind: "wont_do",
          eventId: event.id,
          reason: command.reason,
          actorId: event.actorId,
          actorName: event.actorName,
          occurredAt: event.occurredAt.toISOString(),
          previousState: transition.beforeState,
        }
      : Prisma.DbNull;
  const data = {
    projectId: candidate.projectId,
    activityId: candidate.activityId,
    stageNames: [...candidate.stageNames],
    type: candidate.type,
    workflowStatus: candidate.workflowStatus,
    text: candidate.text,
    tag: candidate.tag,
    priorityRank: candidate.priorityRank,
    carriedOver: candidate.carriedOver,
    pausedReason: candidate.pausedReason,
    nextStepText: candidate.nextStepText,
    resolution,
  };
  if (command.source.kind === "current") {
    await tx.item.update({
      where: {
        reportSectionId_stableId: { reportSectionId: sectionId, stableId },
      },
      data,
    });
  } else {
    await tx.item.create({
      data: { ...data, reportSectionId: sectionId, stableId },
    });
  }
}
