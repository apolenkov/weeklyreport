import type { ReactNode } from "react";

interface ReportToolbarProps {
  periodNavigator?: ReactNode;
  archiveToggle?: ReactNode;
  leadingExtras?: ReactNode;
  trailingExtras?: ReactNode;
}

export function ReportToolbar({
  periodNavigator,
  archiveToggle,
  leadingExtras,
  trailingExtras,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-clip rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5 whitespace-nowrap">
      {/* UAT 2026-05-22: archive toggle sits next to the period selector
          (lead + head share this toolbar, so the move applies to both). */}
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        {periodNavigator}
        {archiveToggle}
      </div>
      {leadingExtras}
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        {trailingExtras}
      </div>
    </div>
  );
}
