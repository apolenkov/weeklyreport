import { type RefObject, useEffect } from "react";

interface OutsidePointerDismissOptions {
  readonly open: boolean;
  // Every surface that counts as "inside": a portaled panel is not in the
  // trigger's subtree, so it has to contribute its own ref.
  readonly refs: readonly RefObject<HTMLElement | null>[];
  readonly onDismiss: () => void;
}

// One rule for every anchored surface: while it is open, a document-level
// mousedown landing in none of its surfaces dismisses it. Escape and focus
// restore are a separate a11y contract and stay with the caller.
export function useDismissOnOutsidePointer({
  open,
  refs,
  onDismiss,
}: OutsidePointerDismissOptions): void {
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent): void {
      const target = event.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target) ?? false);
      if (!inside) onDismiss();
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, refs, onDismiss]);
}
