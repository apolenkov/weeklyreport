import type { ReportSectionReadModel } from "@customreport/shared";

import { CROSS_PRODUCT_ID } from "./section-slide-model-helpers";
import { activityHomeProduct } from "./slide-grid-cells";

export const SHARED_PRODUCT_ID = CROSS_PRODUCT_ID;
export const CROSS_PRODUCT_LABEL = "Shared context";

// Activity-linked rows have no projectId of their own; their home product
// comes from the activity's single linked product (shared card otherwise).
export function buildActivityHomeById(
  section: ReportSectionReadModel,
  knownProductIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  return new Map(
    section.activities.map((activity) => [
      activity.activityId,
      activityHomeProduct(
        activity.linkedProducts,
        knownProductIds,
        SHARED_PRODUCT_ID,
      ),
    ]),
  );
}

// Rows home to their own product, an activity's linked product, or the
// shared card when neither resolves.
export function makeIdentityResolver(
  ownedProducts: ReadonlyMap<string, string>,
  activityHomeById: ReadonlyMap<string, string>,
): (
  productId: string | null | undefined,
  activityId: string | null | undefined,
) => { readonly id: string; readonly name: string } {
  return (productId, activityId) => {
    if (activityId != null) {
      const home = activityHomeById.get(activityId) ?? SHARED_PRODUCT_ID;
      return { id: home, name: ownedProducts.get(home) ?? CROSS_PRODUCT_LABEL };
    }
    return productId && ownedProducts.has(productId)
      ? { id: productId, name: ownedProducts.get(productId) ?? productId }
      : { id: SHARED_PRODUCT_ID, name: CROSS_PRODUCT_LABEL };
  };
}
