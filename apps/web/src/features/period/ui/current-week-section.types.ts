import type {
  KanbanItem,
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";

export interface CurrentWeekSectionProps {
  readonly items: KanbanItem[];
  /**
   * Own risks for each ItemCard so at-risk/blocked derives from covering risks,
   * never a free item status.
   */
  readonly risks?: readonly RiskEntry[];
  readonly readOnly?: boolean;
  /**
   * Next items on add/edit/delete. Parent merges by id into draftSection.items,
   * preserving non-presentation fields (tag, workflowStatus, etc.).
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
   * Author's attached activities for ItemEditDialog's parent picker (alongside
   * products).
   */
  readonly activities?: readonly ParentActivityOption[];
  /**
   * SDLC stages the lead owns on the active product (scopes the stage dropdown).
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * Priority ranks already used by own items for the full period (current +
   * next). Dialog disables them after subtracting the edited item's rank.
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
   * Pause an in-progress item with a required reason. Section owns the prompt;
   * this persists the result.
   */
  readonly onPauseItem?: (id: string, reason: string) => void;
}
