import type { ParentActivityOption, RecordParent } from "../ui/parent-picker";
import type { KanbanItemParent } from "./types";

// Create-mode seed has at most one parent side set, matching the row invariant.
export interface RecordParentSeed {
  readonly productId?: string | undefined;
  readonly activityId?: string | undefined;
}

// Branch order is not permutable: the seed activity is checked BEFORE the row's
// product because the item dialog bakes its seed product into the bound row, and
// an activity-lane create must still win over that baked default.
export function resolveRecordParent(
  row: {
    readonly parent?: KanbanItemParent | undefined;
    readonly activityId?: string | null | undefined;
    readonly productId?: string | null | undefined;
  },
  seed: RecordParentSeed,
  activities: readonly ParentActivityOption[],
): RecordParent {
  if (seed.activityId) return { kind: "activity", id: seed.activityId };
  if (row.parent?.kind === "activity") return row.parent;
  if (row.parent?.kind === "product") return row.parent;
  if (row.activityId) return { kind: "activity", id: row.activityId };
  if (row.productId) return { kind: "product", id: row.productId };
  if (seed.productId) return { kind: "product", id: seed.productId };
  return activities[0]
    ? { kind: "activity", id: activities[0].id }
    : { kind: "unresolved" };
}
