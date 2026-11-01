import { useEffect, useRef, useState } from "react";

// In-place text editing for an editable Overview item: Enter or leaving the
// field commits the trimmed text, Escape cancels, Shift+Enter stays a plain
// line break. A blank commit emits no write and restores the shown text.
const MAX_TEXTAREA_ROWS = 6;
const MIN_TEXTAREA_ROWS = 2;

export function StatusOverviewItemTextEditor({
  label,
  text,
  onSave,
  onCancel,
}: {
  readonly label: string;
  readonly text: string;
  readonly onSave: (text: string, viaKeyboard: boolean) => void;
  readonly onCancel: (viaKeyboard: boolean) => void;
}) {
  const [value, setValue] = useState(text);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Enter and Escape unmount the editor; the same keystroke also blurs the
  // textarea, so a second commit must be dropped.
  const settled = useRef(false);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, []);

  const commit = (viaKeyboard: boolean): void => {
    if (settled.current) return;
    settled.current = true;
    const trimmed = value.trim();
    if (trimmed.length === 0) onCancel(viaKeyboard);
    else onSave(trimmed, viaKeyboard);
  };

  return (
    <textarea
      ref={areaRef}
      aria-label={label}
      value={value}
      rows={Math.min(
        MAX_TEXTAREA_ROWS,
        Math.max(MIN_TEXTAREA_ROWS, value.split("\n").length),
      )}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (settled.current) return;
          settled.current = true;
          onCancel(true);
        } else if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit(true);
        }
      }}
      className="block w-full min-w-0 resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    />
  );
}
