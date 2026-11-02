import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewUnit,
} from "../model/status-overview";

// Creation has one entry point per unit, the header Add item control; its
// composer picks the week, so timeline cells never offer a second Add.
const CREATE_CONTROL =
  "min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]";

function createTarget(
  unit: StatusOverviewUnit,
  source: "current" | "next",
): StatusOverviewCreateTarget {
  return { source, unitKind: unit.kind, unitId: unit.id };
}

// The visible label matches the start of the accessible name (WCAG 2.5.3) and
// stays on mobile, including for a unit with no items.
export function UnitAddItemButton({
  unit,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  if (unit.historical) return null;
  return (
    <button
      type="button"
      aria-label={`Add item to ${unit.name}`}
      data-overview-focus={`add:${unit.key}`}
      onClick={() => onAddItem(createTarget(unit, "current"))}
      className={`inline-flex gap-1 px-2 text-sm font-semibold ${CREATE_CONTROL}`}
    >
      <Plus aria-hidden="true" className="size-4" />
      <span>Add item</span>
    </button>
  );
}
