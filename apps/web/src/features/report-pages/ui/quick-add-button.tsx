"use client";

import { useEffect, useRef, useState } from "react";

// "blocker" is a current item pre-set to workflowStatus=blocked, not a type.
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
}

export function QuickAddButton({
  onPick,
  disabled = false,
  placement = "below",
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
          className={`absolute right-0 z-50 w-48 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-1 shadow-lg ${
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
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
