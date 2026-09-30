import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

export const REPORT_PREVIEW_COUNT = 2;

export function reportHiddenRowCount(rows: readonly unknown[]): number {
  return Math.max(0, rows.length - REPORT_PREVIEW_COUNT);
}

export function ReportItemSlot({
  item,
  onEditItem,
  onPlanItem,
  onMoveItem,
  onConfirmItem,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onPlanItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onMoveItem?:
    | ((
        item: StatusOverviewItem,
        target: "current" | "next",
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onConfirmItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
}) {
  return (
    <div
      data-overview-item-slot
      className="min-w-0 md:flex md:h-full md:flex-1 md:flex-col"
    >
      <StatusOverviewItemPreview
        item={item}
        onEditItem={onEditItem}
        onPlanItem={onPlanItem}
        onMoveItem={onMoveItem}
        onConfirmItem={onConfirmItem}
        onResolvePlan={onResolvePlan}
        onRestorePlan={onRestorePlan}
      />
    </div>
  );
}
