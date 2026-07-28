"use client";

import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

interface DialogSurfaceProps {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
  readonly surfaceClassName: string;
  readonly backdropClassName?: string;
  readonly role?: "dialog" | "alertdialog";
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly ariaDescribedBy?: string;
  readonly testId?: string;
  readonly mode?: string;
  readonly onBackdropKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

const DEFAULT_BACKDROP_CLASS =
  "fixed inset-0 z-[100] flex items-center justify-center bg-black/40";

// Owns modal backdrop dismissal and the target/currentTarget guard. Callers
// provide layout and labelling while clicks inside never need propagation
// handlers or accessibility suppressions.
export function DialogSurface({
  surfaceRef,
  onDismiss,
  children,
  surfaceClassName,
  backdropClassName = DEFAULT_BACKDROP_CLASS,
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  testId,
  mode,
  onBackdropKeyDown,
}: DialogSurfaceProps) {
  return (
    <div
      className={backdropClassName}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      onKeyDown={onBackdropKeyDown}
      role="presentation"
      data-testid={testId}
      data-dialog-mode={mode}
    >
      <div
        ref={surfaceRef}
        className={surfaceClassName}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      >
        {children}
      </div>
    </div>
  );
}
