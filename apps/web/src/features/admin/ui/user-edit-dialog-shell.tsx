"use client";

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
      surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={ariaLabel}
      testId="crud-sheet"
    >
      <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      {children}
    </DialogSurface>
  );
}
