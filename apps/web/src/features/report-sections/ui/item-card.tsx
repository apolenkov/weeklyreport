"use client";

import { deriveCardStatus } from "../model/item-card-status";
import type { StatusBadge } from "../model/item-card-style";
import { cardContainerStyle, STATUS_BADGE } from "../model/item-card-style";
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
  readonly onEdit?: ((id: string) => void) | undefined;
  readonly onDelete?: ((id: string) => void) | undefined;
  // Resolve-not-delete (ADR 0015): published lineage withholds Delete.
  readonly publishedLocked?: boolean | undefined;
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
  readonly onMoveToCurrentWeek?: ((id: string) => void) | undefined;
  readonly onPause?: ((id: string) => void) | undefined;
  readonly readOnly?: boolean | undefined;
  // Parent owns editingId so only one card is editable at a time.
  readonly isEditing?: boolean | undefined;
  // Escape re-sends original text as a no-op-but-close signal.
  readonly onTextSave?: ((id: string, nextText: string) => void) | undefined;
  // At-risk/blocked pill is derived from covering risks (not free status).
  // Activity sections pass none — severity stays isolated by design.
  readonly risks?: readonly RiskEntry[] | undefined;
}

export function ItemCard(props: ItemCardProps) {
  const {
    item,
    risks,
    publishedLocked = false,
    readOnly = false,
    isEditing = false,
    onTextSave,
  } = props;
  const { displayStatus, isBlocked, isPlanned, alarmLocked, lockAuthorName } =
    deriveCardStatus(item, risks);
  const badge = STATUS_BADGE[displayStatus];
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
      <ItemCardHeaderRow
        {...props}
        badge={badge}
        alarmLocked={alarmLocked}
        lockAuthorName={lockAuthorName}
        locked={locked}
        isEditing={isEditing}
        publishedLocked={publishedLocked}
      />

      <ItemCardText
        text={item.text}
        showEditor={showEditor}
        onCommit={commit}
      />

      {!showEditor && displayStatus === "paused" && (
        <PausedReasonNote reason={item.pausedReason} />
      )}

      <ItemCardFooter author={item.author} stageTagsState={stageTagsState} />
    </div>
  );
}

// Card top line: status on the left, item actions on the right. shrink-0 keeps
// this row at its natural height so the fixed card height never clips it — only
// the body text region below flexes.
interface ItemCardHeaderRowProps extends ItemCardProps {
  readonly badge: StatusBadge;
  readonly alarmLocked: boolean;
  readonly lockAuthorName: string | undefined;
  readonly locked: boolean;
  // Resolved from ItemCardProps' optional counterparts by ItemCard.
  readonly isEditing: boolean;
  readonly publishedLocked: boolean;
}

function ItemCardHeaderRow(props: ItemCardHeaderRowProps) {
  const { item, badge, alarmLocked, lockAuthorName, publishedLocked } = props;
  return (
    <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
      <ItemCardBadges
        badge={badge}
        alarmLocked={alarmLocked}
        lockAuthorName={lockAuthorName}
        priorityRank={item.priorityRank}
        publishedLocked={publishedLocked}
      />

      <ItemCardActions {...props} />
    </div>
  );
}

// Item text — editable when in edit mode, static otherwise. The textarea always
// shows the full, untruncated text (seeded into `draft`); only the static
// render clamps.
function ItemCardText({
  text,
  showEditor,
  onCommit,
}: {
  readonly text: string;
  readonly showEditor: boolean;
  readonly onCommit: (next: string) => void;
}) {
  if (showEditor) {
    return (
      <ItemInlineTextEditor key={text} initialText={text} onCommit={onCommit} />
    );
  }
  // flex-1 min-h-0 absorbs the space left by the shrink-0 chrome rows instead of
  // growing the card; line-clamp-3 then clips inside it, and native title shows
  // the full text without a Tooltip dependency.
  return (
    <div
      className="line-clamp-3 min-h-0 flex-1 text-sm text-[var(--color-foreground)]"
      title={text}
    >
      {text}
    </div>
  );
}

// Paused items always carry a reason so reviewers see why it stalled.
function PausedReasonNote({
  reason,
}: {
  readonly reason: string | null | undefined;
}) {
  if (reason == null || reason.trim().length === 0) return null;
  return (
    <p
      className="mt-1 line-clamp-2 shrink-0 text-[11px] italic text-[var(--color-muted-foreground)]"
      title={reason}
    >
      Paused: {reason}
    </p>
  );
}

// Author on the left, compact stage tags on the right. shrink-0 mirrors the top
// row — never compressed by the fixed height.
function ItemCardFooter({
  author,
  stageTagsState,
}: {
  readonly author: string;
  readonly stageTagsState: ReturnType<typeof deriveItemCardStageTags>;
}) {
  return (
    <div className="mt-auto flex shrink-0 items-end justify-between gap-2 pt-2">
      <div className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted-foreground)]">
        {author}
      </div>
      <div className="flex min-w-0 max-w-[72%] flex-wrap items-center justify-end gap-1">
        <ItemCardStageTagsRow {...stageTagsState} />
      </div>
    </div>
  );
}
