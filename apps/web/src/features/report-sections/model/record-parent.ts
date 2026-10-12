import type { KanbanItem } from "./types";

// A record has one parent; unresolved keeps missing ownership explicit.
export type RecordParent = KanbanItem["parent"];

export interface ParentActivityOption {
  readonly id: string;
  readonly name: string;
}

// Create-mode seed may carry both sides: an activity-lane create passes an
// explicit activity next to a baked/default product. The activity seed wins
// (branch order below); the resolved record parent still holds one side only.
export interface RecordParentSeed {
  readonly productId?: string | undefined;
  readonly activityId?: string | undefined;
}

// Branch order is not permutable: the seed activity is checked BEFORE the row's
// product because the item dialog bakes its seed product into the bound row, and
// an activity-lane create must still win over that baked default. An explicit
// unresolved row parent is authoritative too — a stale product seed must not
// fall through to the first activity; only a row with no parent at all reaches
// the activity fallback.
export function resolveRecordParent(
  row: {
    readonly parent?: RecordParent | undefined;
    readonly activityId?: string | null | undefined;
    readonly productId?: string | null | undefined;
  },
  seed: RecordParentSeed,
  activities: readonly ParentActivityOption[],
  products: readonly { readonly id: string }[],
): RecordParent {
  if (seed.activityId) return { kind: "activity", id: seed.activityId };
  if (row.parent !== undefined) return row.parent;
  if (row.activityId) return { kind: "activity", id: row.activityId };
  if (row.productId) return { kind: "product", id: row.productId };
  if (seed.productId) {
    // A supplied create seed is an explicit request. When the caller has the
    // current catalog, reject a stale id instead of rebinding it to a default.
    if (!products.some((product) => product.id === seed.productId)) {
      return { kind: "unresolved" };
    }
    return { kind: "product", id: seed.productId };
  }
  return activities[0]
    ? { kind: "activity", id: activities[0].id }
    : { kind: "unresolved" };
}
