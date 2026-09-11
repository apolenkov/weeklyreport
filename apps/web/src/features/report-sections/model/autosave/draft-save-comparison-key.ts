import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { DraftSaveContent } from "./autosave-types";

function ordered<T>(rows: readonly T[]): T[] {
  return rows
    .map((row) => ({ row, key: encodeAutosaveComparisonKey(row) }))
    .toSorted((left, right) =>
      left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
    )
    .map(({ row }) => row);
}

// Query order is not authored content: priorityRank carries explicit ordering.
// Database recreation may return the same rows in a different physical order.
export function encodeDraftSaveComparisonKey(
  payload: DraftSaveContent,
): string {
  return encodeAutosaveComparisonKey({
    ...payload,
    projectStatuses: ordered(payload.projectStatuses),
    stageStatuses:
      payload.stageStatuses === undefined
        ? undefined
        : ordered(payload.stageStatuses),
    activityStatuses:
      payload.activityStatuses === undefined
        ? undefined
        : ordered(payload.activityStatuses),
    items: ordered(payload.items),
    risks: ordered(payload.risks),
    decisions: ordered(payload.decisions),
  });
}
