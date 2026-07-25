"use client";

import { useEffect, useRef, useState } from "react";

// Caller keys by item.text so external text changes remount a fresh draft.
export function ItemInlineTextEditor({
  initialText,
  onCommit,
}: {
  readonly initialText: string;
  readonly onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Defer focus so the textarea exists in the DOM.
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onCommit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Cancel: re-emit original text, parent clears edit mode.
      onCommit(initialText);
    }
  }

  return (
    <textarea
      ref={textareaRef}
      className="w-full resize-y rounded-md border border-[var(--color-starbucks-accent)] bg-white px-2 py-1.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
      style={{ minHeight: "52px" }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={handleKeyDown}
      aria-label="Edit item text"
    />
  );
}
