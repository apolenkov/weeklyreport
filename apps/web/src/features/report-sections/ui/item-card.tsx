"use client";

import { useEffect, useRef, useState } from "react";

import {
  coveringRisksForItem,
  highestAlarmSeverity,
} from "../../../lib/item-alarm";
import { ItemCardActions } from "../../period";
import {
  cardContainerStyle,
  STATUS_BADGE,
  type StatusBadge,
} from "../model/item-card-style";
import type { ItemStatus, KanbanItem, RiskEntry } from "../model/types";
import { ItemCardBadges } from "./item-card-badges";
import {
  deriveItemCardStageTags,
  ItemCardStageTagsRow,
} from "./item-card-stage-tags";

interface ItemCardProps {
  readonly item: KanbanItem;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  /**
   * Resolve-not-delete (ADR 0015): the record's lineage appeared in a
   * published report. Renders the visible marker and withholds Delete —
   * the record can be marked done or carried forward instead.
   */
  readonly publishedLocked?: boolean;
  /** In-place move action; see ItemCardActions. */
  readonly onMarkComplete?: (id: string) => void;
  /** In-place move action; see ItemCardActions. */
  readonly onMoveToNextWeek?: (id: string) => void;
  /** In-place move action: pull a next-week item back into the current week. */
  readonly onMoveToCurrentWeek?: (id: string) => void;
  /** require-paused-item-reason: open the pause-reason prompt for this item. */
  readonly onPause?: (id: string) => void;
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
  /**
   * The section's own risks. The card's at-risk/blocked pill is DERIVED from
   * the covering risks (never a free item status), mirroring the stage-chip
   * render floor. Only product-parented in-progress items derive an alarm; an
   * activity item's severity stays isolated by design, so the activity
   * section passes none.
   */
  readonly risks?: readonly RiskEntry[];
}

interface DerivedCardStatus {
  displayStatus: ItemStatus | "at-risk";
  isBlocked: boolean;
  isPlanned: boolean;
  alarmLocked: boolean;
  /**
   * Set when the flooring covering risk belongs to ANOTHER author — the current
   * lead cannot resolve it alone, so the lock affordance names that author.
   */
  lockAuthorName?: string;
}

/**
 * The author whose foreign covering risk floors the item, or undefined — only
 * when an own risk does NOT already produce the same floor (that one the lead
 * could resolve themselves, so the generic lock copy applies).
 */
function foreignLockAuthor(
  covering: readonly RiskEntry[],
  alarm: "at-risk" | "blocked" | null,
): string | undefined {
  const own = highestAlarmSeverity(covering.filter((r) => r.foreign !== true));
  if (alarm === null || own === alarm) return undefined;
  return covering.find((r) => r.foreign === true && r.severity === alarm)
    ?.authorName;
}

/**
 * Resolve the pill the card shows. The at-risk/blocked alarm is the roll-up of
 * the covering risks (the item-card analogue of the stage-chip floor), never a
 * free item status. Product-parented items only — an activity item's severity
 * stays isolated; the in-progress gate leaves completed/planned on their
 * progress pill. A derived alarm locks the pill (resolve the covering
 * risk/blocker to change it); a co-owner's flooring risk names its author.
 */
function deriveCardStatus(
  item: KanbanItem,
  risks: readonly RiskEntry[] | undefined,
): DerivedCardStatus {
  // No risk set threaded in, OR a foreign (cross-author) item: trust item.status
  // as-is. Foreign items are mixed into the own-item arrays but carry their
  // author's already-overlaid status (mapForeignItems) — deriving them against
  // the merged risk set would floor them against the wrong risks.
  if (risks === undefined || item.foreign === true) {
    return {
      displayStatus: item.status,
      isBlocked: item.status === "blocked",
      isPlanned: item.status === "planned",
      alarmLocked: false,
    };
  }
  // Stored `blocked` is unrepresentable: the DB CHECK and Zod reject it, and
  // workflowToItemStatus never produces it — an own item's status arrives here
  // as a pure Progress value. `blocked` appears only as the risk-derived alarm
  // below (or pre-baked on foreign rows, which returned early above).
  const covering =
    item.activityId == null && item.productId !== ""
      ? coveringRisksForItem(item, risks)
      : [];
  const derivedAlarm = highestAlarmSeverity(covering);
  const displayStatus: ItemStatus | "at-risk" = derivedAlarm ?? item.status;
  const lockAuthorName = foreignLockAuthor(covering, derivedAlarm);
  return {
    displayStatus,
    isBlocked: displayStatus === "blocked",
    isPlanned: displayStatus === "planned",
    alarmLocked: derivedAlarm !== null,
    ...(lockAuthorName ? { lockAuthorName } : {}),
  };
}

export function ItemCard({
  item,
  risks,
  onEdit,
  onDelete,
  publishedLocked = false,
  onMarkComplete,
  onMoveToNextWeek,
  onMoveToCurrentWeek,
  onPause,
  readOnly = false,
  isEditing = false,
  onTextSave,
}: ItemCardProps) {
  const { displayStatus, isBlocked, isPlanned, alarmLocked, lockAuthorName } =
    deriveCardStatus(item, risks);
  const badge =
    (STATUS_BADGE as Record<string, StatusBadge>)[displayStatus] ??
    STATUS_BADGE["in-progress"];
  const locked = readOnly || item.foreign === true;
  // Same gate as the render branch below — the style must track whichever
  // branch actually renders so an editable-but-locked card still gets the
  // fixed reference height instead of the edit-mode floor.
  const showEditor = isEditing && !locked;
  const stageTagsState = deriveItemCardStageTags(item);

  function commit(next: string) {
    onTextSave?.(item.id, next);
  }

  return (
    <div
      data-testid="item-card"
      className="group relative flex flex-col rounded-[10px] border bg-[var(--color-background)] p-2.5 transition-[border-color,box-shadow,background-color] hover:border-[rgba(0,0,0,0.25)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
      style={cardContainerStyle({
        isPlanned,
        isBlocked,
        foreign: item.foreign === true,
        isEditing: showEditor,
      })}
    >
      {/* Card top line: status on the left, item actions on the right.
          shrink-0 keeps this row at its natural height so the fixed card
          height never clips it — only the body text region below flexes. */}
      <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
        <ItemCardBadges
          badge={badge}
          alarmLocked={alarmLocked}
          lockAuthorName={lockAuthorName}
          priorityRank={item.priorityRank}
          publishedLocked={publishedLocked}
        />

        <ItemCardActions
          item={item}
          locked={locked}
          isEditing={isEditing}
          publishedLocked={publishedLocked}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkComplete={onMarkComplete}
          onMoveToNextWeek={onMoveToNextWeek}
          onMoveToCurrentWeek={onMoveToCurrentWeek}
          onPause={onPause}
        />
      </div>

      {/* Item text — editable when in edit mode, static otherwise. The
          textarea always shows the full, untruncated `item.text` (seeded
          into `draft`); only the static render below clamps. */}
      {showEditor ? (
        <ItemInlineTextEditor
          key={item.text}
          initialText={item.text}
          onCommit={commit}
        />
      ) : (
        // flex-1 min-h-0 lets this region absorb whatever space is left
        // inside the card's fixed height once the shrink-0 chrome rows take
        // theirs, instead of growing the card. line-clamp-3 then clips
        // within that space with an ellipsis; native title gives the full
        // text on hover without pulling in a Tooltip dependency.
        <div
          className="line-clamp-3 min-h-0 flex-1 text-sm text-[var(--color-foreground)]"
          title={item.text}
        >
          {item.text}
        </div>
      )}

      {/* require-paused-item-reason: a paused item always carries the lead's
          reason, surfaced as a muted line so a reviewer sees WHY it stalled. */}
      {!showEditor &&
        displayStatus === "paused" &&
        item.pausedReason != null &&
        item.pausedReason.trim().length > 0 && (
          <p
            className="mt-1 line-clamp-2 shrink-0 text-[11px] italic text-[var(--color-muted-foreground)]"
            title={item.pausedReason}
          >
            Paused: {item.pausedReason}
          </p>
        )}

      {/* Footer: author on the left, compact stage tags on the right.
          shrink-0 mirrors the top row — never compressed by the fixed
          height. */}
      <div className="mt-auto flex shrink-0 items-end justify-between gap-2 pt-2">
        <div className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted-foreground)]">
          {item.author}
        </div>
        <div className="flex min-w-0 max-w-[72%] flex-wrap items-center justify-end gap-1">
          <ItemCardStageTagsRow {...stageTagsState} />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline text editor mounted only while edit mode is on: `draft` initializes
 * from the committed text on mount, and the caller keys this component by
 * `item.text`, so an external text change remounts it — replacing the old
 * reset-in-effect. The textarea always shows the full, untruncated text.
 */
function ItemInlineTextEditor({
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
