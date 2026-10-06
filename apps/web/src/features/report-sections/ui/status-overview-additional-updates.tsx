import type { ActionProps } from "./status-overview-item-actions";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

export const REPORT_PREVIEW_COUNT = 2;

export function reportHiddenRowCount(rows: readonly unknown[]): number {
  return Math.max(0, rows.length - REPORT_PREVIEW_COUNT);
}

export function ReportItemSlot(props: ActionProps) {
  return (
    <div
      data-overview-item-slot
      className="min-w-0 md:flex md:h-full md:flex-1 md:flex-col"
    >
      <StatusOverviewItemPreview {...props} />
    </div>
  );
}
