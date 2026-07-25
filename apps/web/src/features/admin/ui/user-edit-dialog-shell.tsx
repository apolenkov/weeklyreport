"use client";

import type { ReactNode, RefObject } from "react";

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
      data-testid="crud-sheet"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops mouse-click propagation to the backdrop; the dialog is keyboard-closable via Escape + Cancel button */}
      <div
        ref={surfaceRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
