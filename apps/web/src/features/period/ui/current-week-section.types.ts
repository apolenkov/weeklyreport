import type { KanbanItem, Product, RiskEntry } from "../../report-sections";

export interface CurrentWeekSectionProps {
  readonly items: KanbanItem[];
  /**
   * record-status-derived-from-risk: own risks forwarded to each ItemCard so
   * its at-risk/blocked pill derives from the covering risks, never a free item
   * status.
   */
  readonly risks?: readonly RiskEntry[];
  readonly readOnly?: boolean;
  /**
   * Controlled-component callback fired with the next items array on add /
   * inline-edit / delete. The parent must merge this back into its raw
   * `draftSection.items` keyed by id, preserving non-presentation fields
   * (tag, workflowStatus, carriedOver, completed, type).
   */
  readonly onItemsChange?: (items: KanbanItem[]) => void;
  /**
   * Author label used as the default `author` for newly-created items.
   * Falls back to "You" when undefined.
   */
  readonly currentUserName?: string;
  /**
   * Used as the seed product for the empty-state `+ Add` button. Without
   * this prop the section would have no per-product group to attach the
   * Add button to once all items are deleted, leaving a dead section.
   */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the author's attached activities forwarded to
   * ItemEditDialog so the parent picker can offer them alongside products.
   */
  readonly activities?: readonly { id: string; name: string }[];
  /**
   * stages-the-lead-owns selector forwarded to ItemEditDialog so the SDLC
   * stage dropdown is scoped to the active project.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * All priority ranks already in use by own items for the full period
   * (current + next week). Forwarded to ItemEditDialog so taken ranks are
   * disabled in the picker. The dialog subtracts the edited item's own
   * current rank before computing the disabled set.
   */
  readonly ownPeriodRanks?: readonly number[];
  readonly addSignal?: number;
  /**
   * Resolve-not-delete (ADR 0015): item ids whose lineage appeared in a
   * published report — the card shows the marker and withholds Delete.
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMarkComplete?: (id: string) => void;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMoveToNextWeek?: (id: string) => void;
  /**
   * require-paused-item-reason: pause an in-progress item with a required
   * reason. The section owns the reason prompt; this persists the result.
   */
  readonly onPauseItem?: (id: string, reason: string) => void;
}
