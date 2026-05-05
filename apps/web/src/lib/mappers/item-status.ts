/**
 * Item-status mapper: bridges the API ItemWorkflowStatus enum
 * (done/in_progress/blocked) with the UI ItemStatus enum
 * (completed/in-progress/blocked/planned).
 *
 * 'planned' is a computed presentation-only state with no DB enum value:
 * it represents next-week items that have not yet been assigned an
 * explicit workflow status.
 */

export type ItemWorkflowStatus = 'done' | 'in_progress' | 'blocked';
export type ItemType = 'current' | 'next';
export type ItemStatus = 'in-progress' | 'completed' | 'blocked' | 'planned';

/**
 * Converts a stored ItemWorkflowStatus to its presentation ItemStatus.
 * Note: 'planned' is never produced by this function -- it is only
 * derivable from {@link deriveItemStatus} when no workflow status exists.
 */
export function workflowToItemStatus(
  ws: ItemWorkflowStatus,
): Exclude<ItemStatus, 'planned'> {
  switch (ws) {
    case 'done':
      return 'completed';
    case 'in_progress':
      return 'in-progress';
    case 'blocked':
      return 'blocked';
  }
}

/**
 * Inverse mapping for non-computed presentation states.
 * 'planned' has no API equivalent and is excluded at the type level.
 */
export function itemStatusToWorkflow(
  status: Exclude<ItemStatus, 'planned'>,
): ItemWorkflowStatus {
  switch (status) {
    case 'completed':
      return 'done';
    case 'in-progress':
      return 'in_progress';
    case 'blocked':
      return 'blocked';
  }
}

/**
 * Derives the display ItemStatus from an item's stored fields.
 *
 * Rules (per mockup v14 — "next week" cards are visually planned regardless
 * of any backend workflow tag):
 * - type === 'next'    -> 'planned' (always, dashed border in UI)
 * - explicit workflowStatus on a current-week item wins
 * - default for current-week with no workflowStatus -> 'in-progress'
 *
 * Phase 33-04: previously `workflowStatus` overrode `type`, so any next-week
 * item that had ever been touched (and thus carried `in_progress`) lost its
 * dashed border. Next-week IS planning state by definition; surface that.
 */
export function deriveItemStatus(item: {
  workflowStatus: ItemWorkflowStatus | null;
  type: ItemType;
}): ItemStatus {
  if (item.type === 'next') return 'planned';
  if (item.workflowStatus) {
    return workflowToItemStatus(item.workflowStatus);
  }
  return 'in-progress';
}
