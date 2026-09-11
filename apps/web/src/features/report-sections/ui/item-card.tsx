"use client";

import { deriveCardStatus } from "../model/item-card-status";
import type { StatusBadge } from "../model/item-card-style";
import { cardContainerStyle, STATUS_BADGE } from "../model/item-card-style";
import { deriveItemCardStageTags } from "../model/stage-tags";
import type { KanbanItem, RiskEntry } from "../model/types";
import { ItemCardActions } from "./item-card-actions";
import { ItemCardBadges } from "./item-card-badges";
import { ItemCardStageTagsRow } from "./item-card-stage-tags";

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
  // At-risk/blocked display is derived from applicable product-stage risks.
  readonly risks?: readonly RiskEntry[] | undefined;
}

export function ItemCard(props: ItemCardProps) {
  const { item, risks, publishedLocked = false, readOnly = false } = props;
  const { displayStatus, isBlocked, isPlanned, alarmLocked, lockAuthorName } =
    deriveCardStatus(item, risks);
  const badge = STATUS_BADGE[displayStatus];
  const locked = readOnly || item.foreign === true;
  const stageTagsState = deriveItemCardStageTags(item);

  return (
    <div
      data-testid="item-card"
      className="group relative flex min-w-0 flex-col rounded-[10px] border bg-[var(--color-background)] p-2.5 transition-[border-color,box-shadow,background-color] hover:border-[var(--color-border-strong)] hover:shadow-[0_2px_8px_var(--color-highlight-shadow)]"
      style={cardContainerStyle({
        isPlanned,
        isBlocked,
        foreign: item.foreign === true,
      })}
    >
      <ItemCardHeaderRow
        {...props}
        badge={badge}
        alarmLocked={alarmLocked}
        lockAuthorName={lockAuthorName}
        locked={locked}
        publishedLocked={publishedLocked}
      />

      <ItemCardText text={item.text} />

      {displayStatus === "paused" && (
        <PausedReasonNote reason={item.pausedReason} />
      )}

      <ItemCardFooter author={item.author} stageTagsState={stageTagsState} />
    </div>
  );
}

// The status/action row opts out of flex shrink; the body region below flexes.
interface ItemCardHeaderRowProps extends ItemCardProps {
  readonly badge: StatusBadge;
  readonly alarmLocked: boolean;
  readonly lockAuthorName: string | undefined;
  readonly locked: boolean;
  readonly publishedLocked: boolean;
}

function ItemCardHeaderRow(props: ItemCardHeaderRowProps) {
  const { item, badge, alarmLocked, lockAuthorName, publishedLocked } = props;
  return (
    <div className="mb-2 flex min-w-0 shrink-0 flex-wrap items-start justify-between gap-2 md:flex-nowrap">
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

// The card body stays compact; editing uses the full item dialog.
function ItemCardText({ text }: { readonly text: string }) {
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

// The author/stage row opts out of flex shrink like the header row.
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
