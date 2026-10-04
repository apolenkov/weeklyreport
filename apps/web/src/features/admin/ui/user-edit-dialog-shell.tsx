"use client";

import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";

interface UserEditDialogShellProps {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly title: string;
  readonly ariaLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function UserEditDialogShell({
  surfaceRef,
  title,
  ariaLabel,
  onClose,
  children,
}: UserEditDialogShellProps) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onClose}
      surfaceClassName="animate-scale-in relative mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={ariaLabel}
      testId="crud-sheet"
    >
      <h3 className="pr-10 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      {children}
      {/* R91: a visible dismiss target besides Cancel and Escape; last in DOM
          order so initial focus still lands on the first field. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </DialogSurface>
  );
}
