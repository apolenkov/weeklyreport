import type {
  KanbanItem,
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";

export interface CurrentWeekSectionProps {
  readonly items: readonly KanbanItem[];
  // At-risk/blocked derives from covering risks, never a free item status.
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly readOnly?: boolean | undefined;
  // Parent merges by id, preserving non-presentation fields such as tag and
  // workflowStatus.
  readonly onItemsChange?: ((items: readonly KanbanItem[]) => void) | undefined;
  // Seeds new-item author labels; undefined falls back to "You".
  readonly currentUserName?: string | undefined;
  // Seeds the empty-state + Add target after all items are deleted; without a
  // product the section would have no group to attach the action to.
  readonly products: readonly Product[];
  // Supplies the author's activities to ItemEditDialog's parent picker.
  readonly activities?: readonly ParentActivityOption[] | undefined;
  // Scopes the stage dropdown to stages owned on the selected product.
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  // Disables duplicate ranks across current + next periods after excluding the
  // edited item's own rank.
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly addSignal?: number | undefined;
  // Published-lineage ids stay resolvable and withhold Delete.
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
  // Section owns the pause prompt and persists its required reason.
  readonly onPauseItem?: ((id: string, reason: string) => void) | undefined;
}
