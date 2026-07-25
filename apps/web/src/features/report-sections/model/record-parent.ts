import type { ParentActivityOption, RecordParent } from "../ui/parent-picker";

/** Create-mode parent preset — at most one side set (XOR, like the row). */
export interface RecordParentSeed {
  readonly productId?: string;
  readonly activityId?: string;
}

/**
 * Derive a record's initial parent — the bound row's
 * activity or product on edit, else the create-mode seed (an activity lane's
 * "+ Add" presets the activity, a product column presets the product), falling
 * back to the first attached activity for an activity-only lead (no products).
 *
 * Shared by the item, risk, and decision dialogs so the XOR-parent seed rule
 * lives in exactly one place (all three carry the same `activityId`/`productId`
 * pair). The seed activity is checked BEFORE the row's product: the item dialog
 * bakes its seed product into the bound row, and an activity-lane create must
 * still win over that baked default.
 * @param row - The row argument.
 * @param seed - The seed argument.
 * @param activities - The activities argument.
 */
export function resolveRecordParent(
  row: { readonly activityId?: string | null; readonly productId?: string },
  seed: RecordParentSeed,
  activities: readonly ParentActivityOption[],
): RecordParent {
  if (row.activityId) return { kind: "activity", id: row.activityId };
  if (seed.activityId) return { kind: "activity", id: seed.activityId };
  if (row.productId) return { kind: "product", id: row.productId };
  if (seed.productId) return { kind: "product", id: seed.productId };
  return activities[0]
    ? { kind: "activity", id: activities[0].id }
    : { kind: "product", id: "" };
}
