"use client";

import type { ReactNode } from "react";

import { LeadFormAddButton } from "./lead-form-add-button";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

export const NO_PRODUCTS_ASSIGNED_MESSAGE =
  "No products assigned — contact admin";

type AssignedProducts = LeadFormLoadedViewModel["products"];

// Disabled with an explanatory title when the lead owns no product, so the
// dead-end is legible instead of an inert button.
function AddItemButton({
  onClick,
  products,
}: {
  readonly onClick: () => void;
  readonly products: AssignedProducts;
}) {
  const firstProduct = products[0];
  return (
    <LeadFormAddButton
      onClick={onClick}
      disabled={products.length === 0}
      title={
        firstProduct !== undefined
          ? `Add item to ${firstProduct.name}`
          : NO_PRODUCTS_ASSIGNED_MESSAGE
      }
    >
      + Add Item
    </LeadFormAddButton>
  );
}

// Read-only sections pass `null`, not an empty element: AccordionSection keys
// its chevron placement off the presence of the actions slot.
/**
 * Actions slot for the add-item control (null when read-only).
 */
export function addItemAction(
  readOnly: boolean,
  onClick: () => void,
  products: AssignedProducts,
): ReactNode {
  return readOnly ? null : (
    <AddItemButton onClick={onClick} products={products} />
  );
}
