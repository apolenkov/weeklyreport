import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@weeklyreport/ui/components/ui/dialog";
import { type ReactNode, useRef } from "react";

export function OverviewItemDialogSurface({
  title,
  onCancel,
  children,
}: {
  readonly title: string;
  readonly onCancel: () => void;
  readonly children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const requestClose = () => {
    // The canonical Cancel owns dirty-input confirmation before host recovery.
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>(
      "form button[type=button]",
    );
    const cancel = [...(buttons ?? [])].find(
      (button) => button.textContent === "Cancel",
    );
    if (cancel) cancel.click();
    else onCancel();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
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
        <DialogTitle className="pr-10">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
