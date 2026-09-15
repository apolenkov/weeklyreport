import type { RefObject } from "react";

import type { StatusOverviewItem } from "../model/status-overview";

export const OVERVIEW_ITEM_ACTION_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
export const OVERVIEW_ITEM_QUIET_ACTION_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

export function StatusOverviewQuickEditForm({
  draft,
  item,
  onCancel,
  onChange,
  onSave,
  textareaRef,
}: {
  readonly draft: string;
  readonly item: StatusOverviewItem;
  readonly onCancel: () => void;
  readonly onChange: (next: string) => void;
  readonly onSave?: (() => void) | undefined;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        onSave?.();
      }}
    >
      <textarea
        ref={textareaRef}
        rows={2}
        value={draft}
        readOnly={!onSave}
        aria-label={`Edit update text: ${item.text}`}
        onChange={onSave ? (event) => onChange(event.target.value) : undefined}
        onKeyDown={(event) => {
          // While an IME composition is active Escape belongs to the input
          // method; closing the editor would discard the composed text.
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm leading-5 text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      />
      <div className="mt-1 flex items-center gap-1">
        {onSave ? (
          <button type="submit" className={OVERVIEW_ITEM_ACTION_CLASS}>
            Save
          </button>
        ) : null}
        <button
          type="button"
          className={OVERVIEW_ITEM_QUIET_ACTION_CLASS}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
