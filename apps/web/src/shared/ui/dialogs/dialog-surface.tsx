"use client";

import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

interface DialogSurfaceProps {
  readonly isPending?: boolean | undefined;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
  readonly surfaceClassName: string;
  readonly backdropClassName?: string | undefined;
  readonly role?: "dialog" | "alertdialog" | undefined;
  readonly ariaLabel?: string | undefined;
  readonly ariaLabelledBy?: string | undefined;
  readonly ariaDescribedBy?: string | undefined;
  readonly testId?: string | undefined;
  readonly mode?: string | undefined;
  readonly onBackdropKeyDown?: KeyboardEventHandler<HTMLDivElement> | undefined;
}

const DEFAULT_BACKDROP_CLASS =
  "fixed inset-0 z-[var(--layer-dialog)] flex items-center justify-center bg-[var(--color-overlay)]";

// Owns modal backdrop dismissal and the target/currentTarget guard. Callers
// provide layout and labelling while clicks inside never need propagation
// handlers or accessibility suppressions.
export function DialogSurface({
  isPending,
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
        if (!isPending && event.target === event.currentTarget) onDismiss();
      }}
      onKeyDown={isPending ? undefined : onBackdropKeyDown}
      role="presentation"
      data-testid={testId}
      data-dialog-mode={mode}
    >
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className={`${surfaceClassName} overscroll-contain`}
        role={role}
        aria-modal="true"
        aria-busy={isPending ? true : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      >
        {isPending === undefined ? (
          children
        ) : (
          <fieldset disabled={isPending} className="contents">
            {children}
          </fieldset>
        )}
      </div>
    </div>
  );
}
