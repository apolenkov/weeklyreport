"use client";

import type { ReactNode } from "react";

import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import { LeadFormAddButton } from "./lead-form-add-button";

export const NO_RECORD_PARENTS_MESSAGE =
  "No products or activities assigned — contact admin";

type AssignedProducts = LeadFormLoadedViewModel["products"];

function AddItemButton({
  onClick,
  products,
  activities,
}: {
  readonly onClick: () => void;
  readonly products: AssignedProducts;
  readonly activities: LeadFormLoadedViewModel["activityOptions"];
}) {
  const parent = products[0] ?? activities[0];
  return (
    <LeadFormAddButton
      onClick={onClick}
      disabled={parent === undefined}
      title={
        parent !== undefined
          ? `Add item to ${parent.name}`
          : NO_RECORD_PARENTS_MESSAGE
      }
    >
      + Add item
    </LeadFormAddButton>
  );
}

// Read-only sections pass `null`, not an empty element: AccordionSection keys
// its chevron placement off the presence of the actions slot.
export function addItemAction(
  readOnly: boolean,
  onClick: () => void,
  products: AssignedProducts,
  activities: LeadFormLoadedViewModel["activityOptions"],
): ReactNode {
  return readOnly ? null : (
    <AddItemButton
      onClick={onClick}
      products={products}
      activities={activities}
    />
  );
}
