"use client";

import { deriveCardStatus } from "../model/item-card-status";
import {
  cardContainerStyle,
  STATUS_BADGE,
  type StatusBadge,
} from "../model/item-card-style";
import type { KanbanItem, RiskEntry } from "../model/types";
import { ItemCardActions } from "./item-card-actions";
import { ItemCardBadges } from "./item-card-badges";
import {
  deriveItemCardStageTags,
  ItemCardStageTagsRow,
} from "./item-card-stage-tags";
import { ItemInlineTextEditor } from "./item-inline-text-editor";

interface ItemCardProps {
  readonly item: KanbanItem;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  // Resolve-not-delete (ADR 0015): published lineage withholds Delete.
  readonly publishedLocked?: boolean;
  readonly onMarkComplete?: (id: string) => void;
  readonly onMoveToNextWeek?: (id: string) => void;
  readonly onMoveToCurrentWeek?: (id: string) => void;
  readonly onPause?: (id: string) => void;
  readonly readOnly?: boolean;
  // Parent owns editingId so only one card is editable at a time.
  readonly isEditing?: boolean;
  // Escape re-sends original text as a no-op-but-close signal.
  readonly onTextSave?: (id: string, nextText: string) => void;
  // At-risk/blocked pill is derived from covering risks (not free status).
  // Activity sections pass none — severity stays isolated by design.
  readonly risks?: readonly RiskEntry[];
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

      {/* Paused items always carry a reason so reviewers see why it stalled. */}
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
