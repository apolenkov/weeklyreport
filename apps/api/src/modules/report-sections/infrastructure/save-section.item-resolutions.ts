import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { ReportSectionDomainError } from "../application/report-sections.service";

export const itemResolutionGuardSelect = {
  stableId: true,
  projectId: true,
  activityId: true,
  type: true,
  text: true,
  tag: true,
  workflowStatus: true,
  carriedOver: true,
  priorityRank: true,
  pausedReason: true,
  nextStepText: true,
  stageNames: true,
  resolution: true,
} satisfies Prisma.ItemSelect;

type PersistedItemResolutionRow = Prisma.ItemGetPayload<{
  select: typeof itemResolutionGuardSelect;
}>;

function hasSameStageNames(
  persisted: readonly string[],
  incoming: readonly string[],
): boolean {
  return (
    persisted.length === incoming.length &&
    persisted.every((stageName, index) => stageName === incoming[index])
  );
}

function matchesResolvedItem(
  persisted: PersistedItemResolutionRow,
  incoming: ReportSectionReadModel["items"][number],
): boolean {
  return (
    incoming.stableId === persisted.stableId &&
    (incoming.projectId ?? null) === persisted.projectId &&
    (incoming.activityId ?? null) === persisted.activityId &&
    incoming.type === persisted.type &&
    incoming.text === persisted.text &&
    incoming.tag === persisted.tag &&
    incoming.workflowStatus === persisted.workflowStatus &&
    (incoming.carriedOver === persisted.carriedOver ||
      (persisted.carriedOver && !incoming.carriedOver)) &&
    (incoming.priorityRank ?? null) === persisted.priorityRank &&
    (incoming.pausedReason ?? null) === persisted.pausedReason &&
    (incoming.nextStepText ?? null) === persisted.nextStepText &&
    hasSameStageNames(persisted.stageNames, incoming.stageNames)
  );
}

function resolutionLockedError(): ReportSectionDomainError {
  return new ReportSectionDomainError(
    "ITEM_RESOLUTION_LOCKED",
    "A cancelled item can only be changed with Restore plan.",
  );
}

/**
 * Rejects ordinary writes that alter or delete a cancelled item. The sole
 * exception confirms a legacy carried marker from true to false. Returns only
 * the authoritative JSON that must survive the delete-recreate cycle.
 */
export function preserveResolvedItemJson(
  items: readonly ReportSectionReadModel["items"][number][],
  persistedItems: readonly PersistedItemResolutionRow[],
): ReadonlyMap<string, Prisma.InputJsonValue> {
  const incomingByStableId = new Map(
    items.flatMap((item) =>
      item.stableId === undefined ? [] : [[item.stableId, item] as const],
    ),
  );
  const resolutions = new Map<string, Prisma.InputJsonValue>();

  for (const persisted of persistedItems) {
    if (persisted.resolution == null) continue;

    const incoming = incomingByStableId.get(persisted.stableId);
    if (incoming === undefined || !matchesResolvedItem(persisted, incoming)) {
      throw resolutionLockedError();
    }

    // `resolution` came from Prisma JSON and is not supplied by the client.
    // It is non-null above, which makes it valid createMany JSON input.
    resolutions.set(persisted.stableId, persisted.resolution);
  }

  return resolutions;
}
