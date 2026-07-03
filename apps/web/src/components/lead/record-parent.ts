import type { ParentActivityOption, RecordParent } from "./product-picker";

/**
 * activity-first-class: derive a record's initial parent — the bound row's
 * activity or product on edit, else the create-mode seed product, falling back
 * to the first attached activity for an activity-only lead (no products).
 *
 * Shared by the item, risk, and decision dialogs so the XOR-parent seed rule
 * lives in exactly one place (all three carry the same `activityId`/`productId`
 * pair). The item dialog bakes its seed product into the bound row before
 * calling, so it passes `undefined` for `seedProductId`.
 */
export function resolveRecordParent(
  row: { readonly activityId?: string | null; readonly productId?: string },
  seedProductId: string | undefined,
  activities: readonly ParentActivityOption[],
): RecordParent {
  if (row.activityId) return { kind: "activity", id: row.activityId };
  if (row.productId) return { kind: "product", id: row.productId };
  if (seedProductId) return { kind: "product", id: seedProductId };
  return activities[0]
    ? { kind: "activity", id: activities[0].id }
    : { kind: "product", id: "" };
}
