import type { KanbanItem, Product, RiskEntry } from "../types";

export interface NextWeekSectionProps {
  readonly items: readonly KanbanItem[];
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly readOnly?: boolean | undefined;
  readonly onItemsChange?: ((items: readonly KanbanItem[]) => void) | undefined;
  readonly currentUserName?: string | undefined;
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly { id: string; name: string }[] | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly addSignal?: number | undefined;
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onMoveToCurrentWeek?: ((id: string) => void) | undefined;
}
