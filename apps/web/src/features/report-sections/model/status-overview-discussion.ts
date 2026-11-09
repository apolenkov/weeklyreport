import type { StatusOverviewItem } from "./status-overview";

/**
 * Whether the Lead's own live item offers its discussion. Eligibility follows
 * ownership and the editable report, not the editor controls: a resolved item
 * loses its edit target but keeps its discussion. `canRestore` is true exactly
 * for a persisted, resolved, non-Previous item of the editable section. The
 * server still authorizes every read and reply.
 */
export function canDiscussItem(item: StatusOverviewItem): boolean {
  return item.editTarget !== null || item.canRestore;
}
