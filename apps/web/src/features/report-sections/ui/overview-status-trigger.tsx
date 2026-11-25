import { DropdownMenuTrigger } from "@weeklyreport/ui/components/ui/dropdown-menu";
import type { ReactNode } from "react";

import { ICON_BUTTON_CLASS } from "./status-overview-item-actions";
export function StaticStatusIcon({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center"
    >
      {children}
    </span>
  );
}

export function StatusTrigger({
  id,
  label,
  focusKey,
  children,
}: {
  readonly id: string | undefined;
  readonly label: string;
  readonly focusKey: string;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <button
        // The submit-readiness summary deep-links to this id and focus key.
        id={id}
        type="button"
        aria-label={label}
        title={label}
        data-overview-focus={focusKey}
        className={ICON_BUTTON_CLASS}
      >
        {children}
      </button>
    </DropdownMenuTrigger>
  );
}
