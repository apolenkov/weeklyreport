"use client";

import { useEffect, useRef, useState } from "react";

import { LockBadge } from "../report-shell/lock-badge";
import type { KanbanItem } from "./mock-data";
import { splitStageNames } from "./stage-tags";

interface ItemCardProps {
  readonly item: KanbanItem;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  readonly readOnly?: boolean;
  /**
   * When true, the card renders an inline textarea seeded with `item.text`
   * instead of the static text. Blur, Enter, or Escape commit/cancel via
   * `onTextSave`. Owned by the parent section so only one card is editable
   * at a time.
   */
  readonly isEditing?: boolean;
  /**
   * Commit handler for inline edit. Called with `(id, nextText)` on Enter or
   * blur. Called with the original text on Escape (caller treats this as a
   * no-op-but-close signal). The parent section is responsible for clearing
   * its `editingId` state.
   */
  readonly onTextSave?: (id: string, nextText: string) => void;
}

interface StatusBadge {
  bg: string;
  text: string;
  label: string;
}

const STATUS_BADGE = {
  "in-progress": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "In Progress",
  },
  completed: { bg: "var(--color-primary)", text: "#fff", label: "Completed" },
  blocked: {
    bg: "#fee2e2",
    text: "var(--color-destructive)",
    label: "Blocked",
  },
  planned: {
    bg: "var(--color-muted)",
    text: "var(--color-muted-foreground)",
    label: "Planned",
  },
} as const satisfies Record<string, StatusBadge>;

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function ItemCard({
  item,
  onEdit,
  onDelete,
  readOnly = false,
  isEditing = false,
  onTextSave,
}: ItemCardProps) {
  const badge =
    (STATUS_BADGE as Record<string, StatusBadge>)[item.status] ??
    STATUS_BADGE["in-progress"];
  const isBlocked = item.status === "blocked";
  const isPlanned = item.status === "planned";
  const locked = readOnly || item.foreign === true;
  const stageTags =
    item.stageIds && item.stageIds.length > 0
      ? item.stageIds
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(item.stageName);
  const stageTagsLabel =
    stageTags.length === 0 ? "All stages" : stageTags.join(", ");
  const visibleStageTags = stageTags.slice(0, 2);
  const hiddenStageCount = Math.max(
    stageTags.length - visibleStageTags.length,
    0,
  );

  // Local draft for the inline textarea. Reset every time edit mode opens so
  // the field tracks the latest committed text.
  const [draft, setDraft] = useState(item.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(item.text);
      // Defer focus so the textarea exists in the DOM.
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      });
    }
  }, [isEditing, item.text]);

  function commit(next: string) {
    onTextSave?.(item.id, next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Cancel: re-emit original text, parent clears edit mode.
      commit(item.text);
    }
  }

  return (
    <div
      data-testid="item-card"
      className="group relative flex flex-col rounded-[10px] border bg-[var(--color-background)] p-2.5 transition-[border-color,box-shadow,background-color] hover:border-[rgba(0,0,0,0.25)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
      style={{
        // min-height + flex column keeps every card the same baseline height
        // regardless of whether the description wraps to 1 or 3 lines, so
        // rows across products feel aligned at a glance.
        minHeight: 110,
        // Mockup uses a fully-dashed border on Planned (Next Week) items
        // and a solid + colour-coded left strip on Current Week. We build
        // every side explicitly to avoid the shorthand-vs-longhand React
        // warning that borderLeft+borderStyle was producing.
        borderTop: `1px ${isPlanned ? "dashed" : "solid"} ${isBlocked ? "rgba(200,32,20,0.2)" : "var(--color-muted)"}`,
        borderRight: `1px ${isPlanned ? "dashed" : "solid"} ${isBlocked ? "rgba(200,32,20,0.2)" : "var(--color-muted)"}`,
        borderBottom: `1px ${isPlanned ? "dashed" : "solid"} ${isBlocked ? "rgba(200,32,20,0.2)" : "var(--color-muted)"}`,
        // KB-1 (Phase 33-04): planned cards keep a 3px dashed tealA left strip
        // so column alignment with current-week cards reads identically. The
        // earlier 1px gray dashed left turned planned columns visually narrower.
        borderLeft: isPlanned
          ? `3px dashed var(--color-starbucks-accent)`
          : `3px solid ${isBlocked ? "var(--color-destructive)" : "var(--color-starbucks-accent)"}`,
        background: isBlocked ? "#fee2e2" : "var(--color-background)",
        opacity: item.foreign ? 0.7 : 1,
      }}
    >
      {/* Card top line: status on the left, item actions on the right. */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span
            className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ background: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
          {item.priorityRank != null && (
            <span
              role="img"
              className="inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{ background: "#cba258", color: "#fff" }}
              aria-label={`Priority ${item.priorityRank}`}
              title={`Priority rank ${item.priorityRank}`}
            >
              P{item.priorityRank}
            </span>
          )}
        </div>

        {!locked && !isEditing ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
              onClick={() => onEdit?.(item.id)}
              aria-label="Edit"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[#fee2e2] hover:text-[var(--color-destructive)]"
              onClick={() => onDelete?.(item.id)}
              aria-label="Delete"
            >
              <DeleteIcon />
            </button>
          </div>
        ) : item.foreign === true ? (
          <div className="flex shrink-0 gap-1">
            <LockBadge authorName={item.author} variant="slim" />
          </div>
        ) : null}
      </div>

      {/* Item text — editable when in edit mode, static otherwise */}
      {isEditing && !locked ? (
        <textarea
          ref={textareaRef}
          className="w-full resize-y rounded-md border border-[var(--color-starbucks-accent)] bg-white px-2 py-1.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
          style={{ minHeight: "52px" }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={handleKeyDown}
          aria-label="Edit item text"
        />
      ) : (
        // line-clamp-3 keeps every card baseline-aligned: long text overflows
        // gracefully into ellipsis instead of pushing the row's height past
        // siblings. Native title attribute gives the full text on hover
        // without pulling in a Tooltip dependency.
        <div
          className="line-clamp-3 text-sm text-[var(--color-foreground)]"
          title={item.text}
        >
          {item.text}
        </div>
      )}

      {/* Footer: author on the left, compact stage tags on the right. */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted-foreground)]">
          {item.author}
        </div>
        <div className="flex min-w-0 max-w-[72%] flex-wrap items-center justify-end gap-1">
          <span
            role="img"
            className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1"
            aria-label={`Item stages: ${stageTagsLabel}`}
            title={stageTagsLabel}
          >
            {stageTags.length === 0 ? (
              <span className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]">
                All stages
              </span>
            ) : (
              visibleStageTags.map((stage) => (
                <span
                  key={stage}
                  className="inline-flex max-w-[92px] items-center truncate rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]"
                  title={stage}
                >
                  {stage}
                </span>
              ))
            )}
            {hiddenStageCount > 0 && (
              <span
                className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]"
                title={stageTagsLabel}
              >
                +{hiddenStageCount}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
