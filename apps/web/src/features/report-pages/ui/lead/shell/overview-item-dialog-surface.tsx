import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { type ReactNode, type RefObject, useRef } from "react";

export function OverviewItemDialogSurface({
  title,
  onCancel,
  requestCloseRef,
  children,
}: {
  readonly title: string;
  readonly onCancel: () => void;
  readonly requestCloseRef: RefObject<(() => void) | null>;
  readonly children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const requestClose = () => {
    if (requestCloseRef.current) requestCloseRef.current();
    else if (panel.current && !panel.current.querySelector("form")) onCancel();
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <SheetContent
        ref={panel}
        aria-modal="true"
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--color-popover)] sm:max-w-3xl max-md:[&_[data-slot=dialog-close]]:min-h-[var(--touch-target-min)] max-md:[&_[data-slot=dialog-close]]:min-w-[var(--touch-target-min)]"
        onOpenAutoFocus={(event) => {
          // The canonical editor focuses its description on mount and batch reset.
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          // Overview owns trigger/new-item focus, including identity changes after save.
          event.preventDefault();
        }}
      >
        <SheetTitle className="pr-10">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
