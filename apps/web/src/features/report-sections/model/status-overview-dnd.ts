import type { StatusOverviewItem } from "./status-overview";
import { statusOverviewItemActions } from "./status-overview-items";

// Drag-and-drop resolution for the Report Overview lanes. A lane is identified
// by the week it holds ("current" | "next" | "previous"); the decision of what
// a release does stays in one pure function so pointer plumbing and tests can
// share it. Previously planned is never a drop source or drop target.

export type OverviewDropColumn = "current" | "next" | "previous";

const DRAGGABLE_PREFIX = "overview-drag:";
const DROPPABLE_PREFIX = "overview-drop:";

export function overviewDraggableId(item: StatusOverviewItem): string {
  return `${DRAGGABLE_PREFIX}${item.key}`;
}

export function overviewDroppableId(
  column: OverviewDropColumn,
  laneKey: string,
): string {
  return `${DROPPABLE_PREFIX}${column}:${laneKey}`;
}

/** A card may drag exactly when its other move affordances apply. */
export function overviewItemMovable(item: StatusOverviewItem): boolean {
  return statusOverviewItemActions(item).secondary.includes("move");
}

/**
 * The week a release commits to, or null when the drop is a no-op: outside a
 * lane, onto the item's own week, onto Previous, or for an item that may not
 * move. The returned value feeds the same `onMoveItem` handler as the
 * week-move icon and the Alt+Arrow shortcut.
 */
export function resolveDrop(
  item: StatusOverviewItem | undefined,
  overColumn: OverviewDropColumn | undefined,
): "current" | "next" | null {
  if (item === undefined || overColumn === undefined) return null;
  if (overColumn === "previous" || overColumn === item.source) return null;
  if (!overviewItemMovable(item)) return null;
  return overColumn;
}
