"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDismissOnOutsidePointer } from "../../../../../shared/hooks/browser/use-dismiss-on-outside-pointer";

// "blocker" routes to the risk editor with blocked severity; it is a shortcut,
// not a separate record type.
export type QuickAddKind =
  "current-item" | "next-item" | "decision" | "risk" | "blocker";

const QUICK_ADD_OPTIONS: readonly { kind: QuickAddKind; label: string }[] = [
  { kind: "current-item", label: "Current week item" },
  { kind: "next-item", label: "Next week item" },
  { kind: "blocker", label: "Blocker" },
  { kind: "risk", label: "Risk" },
  { kind: "decision", label: "Decision" },
];

interface QuickAddButtonProps {
  readonly onPick: (kind: QuickAddKind) => void;
  readonly disabled?: boolean;
  readonly placement?: "above" | "below";
  // Kinds the current section cannot meaningfully create; rendered inert with
  // an explanatory title instead of being silently dropped.
  readonly disabledKinds?: ReadonlySet<QuickAddKind> | undefined;
} // Escape dismisses the popup and returns focus to the trigger it was opened
// from; outside-pointer dismissal is the shared rule.
function useDismissOnEscape({
  open,
  triggerRef,
  onDismiss,
}: {
  readonly open: boolean;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  readonly onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, triggerRef, onDismiss]);
}

function QuickAddMenu({
  placement,
  onPick,
  disabledKinds,
}: {
  readonly placement: "above" | "below";
  readonly onPick: (kind: QuickAddKind) => void;
  readonly disabledKinds: ReadonlySet<QuickAddKind>;
}) {
  return (
    <div
      role="group"
      aria-label="Quick-add record type"
      className={`absolute right-0 z-50 w-48 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-1 shadow-lg ${
        placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
      }`}
    >
      {QUICK_ADD_OPTIONS.map((option) => {
        const unavailable = disabledKinds.has(option.kind);
        return (
          <button
            key={option.kind}
            type="button"
            disabled={unavailable}
            title={
              unavailable
                ? "Add a product before reporting a blocker for it"
                : undefined
            }
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--color-muted-foreground)]"
            onClick={() => onPick(option.kind)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function QuickAddButton({
  onPick,
  disabled = false,
  placement = "below",
  disabledKinds = new Set<QuickAddKind>(),
}: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsidePointer({ open, refs: [wrapRef], onDismiss: close });
  useDismissOnEscape({ open, triggerRef, onDismiss: close });

  function handlePick(kind: QuickAddKind) {
    if (disabledKinds.has(kind)) return;
    // The option disappears with the popup. Establish the local trigger as
    // the durable opener before the selected dialog captures focus.
    triggerRef.current?.focus();
    setOpen(false);
    onPick(kind);
  }

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        // Disclosure pattern: aria-expanded alone is correct for a
        // role="group" popup — any aria-haspopup value here lies to AT
        // ("true" is spec-equivalent to "menu", and this is not a menu).
        aria-expanded={open}
        title="Quick-add a record"
      >
        + Add
      </button>
      {open && (
        <QuickAddMenu
          placement={placement}
          onPick={handlePick}
          disabledKinds={disabledKinds}
        />
      )}
    </div>
  );
}
