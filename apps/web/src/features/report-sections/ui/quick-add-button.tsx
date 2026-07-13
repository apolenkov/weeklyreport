"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The five quick-add entries. Each opens the EXISTING per-type dialog with
 * its validated schema — no new editor and no new record model. "blocker" is
 * a current item pre-set to `workflowStatus=blocked`, not a record type.
 */
export type QuickAddKind =
  | "current-item"
  | "next-item"
  | "decision"
  | "risk"
  | "blocker";

const QUICK_ADD_OPTIONS: readonly { kind: QuickAddKind; label: string }[] = [
  { kind: "current-item", label: "Current week item" },
  { kind: "next-item", label: "Next week item" },
  { kind: "blocker", label: "Blocker" },
  { kind: "risk", label: "Risk" },
  { kind: "decision", label: "Decision" },
];

interface QuickAddButtonProps {
  /** Fired with the picked type; the lead form routes to the right dialog. */
  readonly onPick: (kind: QuickAddKind) => void;
  readonly disabled?: boolean;
}

/**
 * The single "+ Add" quick-entry affordance on the lead form: one button
 * opening a type picker (current-item / next-item / decision / risk /
 * blocker). Picking an option opens the existing per-type dialog, so every
 * write invariant (owned stage, stage + product on decision, the submit
 * gate) is enforced by the dialog + server exactly as before.
 */
export function QuickAddButton({
  onPick,
  disabled = false,
}: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handlePick(kind: QuickAddKind) {
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
        <div
          role="group"
          aria-label="Quick-add record type"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-1 shadow-lg"
        >
          {QUICK_ADD_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
              onClick={() => handlePick(option.kind)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
