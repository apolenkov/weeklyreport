"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { deriveItemAlarmFromRisks } from "../../lib/item-alarm";
import { ItemCardActions, PublishedRecordMarker } from "./item-card-actions";
import type { ItemStatus, KanbanItem, RiskEntry } from "./mock-data";
import { canonicalStageName, splitStageNames } from "./stage-tags";

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
   * record-status-derived-from-risk: the section's own risks. The card's
   * at-risk/blocked pill is DERIVED from the covering risks (never a free item
   * status), mirroring the stage-chip render floor. Only product-parented
   * in-progress items derive an alarm; an activity item's severity stays
   * isolated (Q1 Phase-1 lock), so the activity section passes none.
   */
  readonly risks?: readonly RiskEntry[];
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
  completed: {
    bg: "var(--color-primary)",
    text: "var(--color-primary-foreground)",
    label: "Completed",
  },
  blocked: {
    bg: "var(--color-status-blocked-bg)",
    text: "var(--color-destructive)",
    label: "Blocked",
  },
  // record-status-derived-from-risk: a DERIVED-only amber alarm (there is no
  // stored at-risk item status) — token-derived per status-color-semantics.
  "at-risk": {
    bg: "var(--color-status-at-risk-bg)",
    text: "var(--color-status-at-risk-fg)",
    label: "At Risk",
  },
  planned: {
    bg: "var(--color-muted)",
    text: "var(--color-muted-foreground)",
    label: "Planned",
  },
} as const satisfies Record<string, StatusBadge>;

/**
 * Fixed card height for the static render, matching the section-level
 * empty-state placeholder ("No items yet" in current-week-section.tsx /
 * next-week-section.tsx) so every card in a column is uniform (B1). The height
 * is sized to the CONTENT, not the empty placeholder: it fits the status-pill /
 * action row + three body lines (the `line-clamp-3` the body keeps) + the
 * author / stage-tag footer + padding. A short card fills the slack with
 * whitespace; a long one truncates at three lines with an ellipsis (its full
 * text stays available via the `title` hover tooltip). The chrome rows keep
 * their natural size (`shrink-0`); the body is the only flexible slot.
 */
const ITEM_CARD_REFERENCE_HEIGHT = 150;

function cardContainerStyle(opts: {
  isPlanned: boolean;
  isBlocked: boolean;
  foreign: boolean;
  isEditing: boolean;
}): CSSProperties {
  const { isPlanned, isBlocked, foreign, isEditing } = opts;
  const borderStyle = isPlanned ? "dashed" : "solid";
  // Faint blocked border = the destructive token at 20% (token-derived, no
  // hardcoded status literal — status-color-semantics).
  const borderColor = isBlocked
    ? "color-mix(in srgb, var(--color-destructive) 20%, transparent)"
    : "var(--color-muted)";
  return {
    // The reference height is fixed for the static render; inline edit
    // relaxes it to a floor so the textarea can grow past it to show the
    // full untruncated text (never clipped while editing).
    ...(isEditing
      ? { minHeight: ITEM_CARD_REFERENCE_HEIGHT }
      : { height: ITEM_CARD_REFERENCE_HEIGHT }),
    borderTop: `1px ${borderStyle} ${borderColor}`,
    borderRight: `1px ${borderStyle} ${borderColor}`,
    borderBottom: `1px ${borderStyle} ${borderColor}`,
    borderLeft: isPlanned
      ? `3px dashed var(--color-starbucks-accent)`
      : `3px solid ${isBlocked ? "var(--color-destructive)" : "var(--color-starbucks-accent)"}`,
    background: isBlocked
      ? "var(--color-status-blocked-bg)"
      : "var(--color-background)",
    opacity: foreign ? 0.7 : 1,
  };
}

interface DerivedCardStatus {
  displayStatus: ItemStatus | "at-risk";
  isBlocked: boolean;
  isPlanned: boolean;
  alarmLocked: boolean;
}

/**
 * record-status-derived-from-risk: resolve the pill the card shows. The
 * at-risk/blocked alarm is the roll-up of the covering risks (the item-card
 * analogue of the stage-chip floor), never a free item status. Product-parented
 * items only — an activity item's severity stays deferred (Q1 Phase-1
 * isolation); the derivation's in-progress gate leaves completed/planned items
 * on their progress pill. When an alarm is derived the pill is locked (resolve
 * the covering risk/blocker to change it). A legacy stored `blocked` with no
 * covering risk shows as in-progress — `blocked` is display-derived only now.
 */
function deriveCardStatus(
  item: KanbanItem,
  risks: readonly RiskEntry[] | undefined,
): DerivedCardStatus {
  // No risk set threaded in, OR a foreign (cross-author) item: trust item.status
  // as-is. Foreign items are mixed into the own-item arrays but carry their
  // author's already-overlaid status (mapForeignItems) — deriving them against
  // the VIEWER's own risks would floor them against the wrong risk set. The
  // covering-risk overlay applies only to own items with the section's risks.
  if (risks === undefined || item.foreign === true) {
    return {
      displayStatus: item.status,
      isBlocked: item.status === "blocked",
      isPlanned: item.status === "planned",
      alarmLocked: false,
    };
  }
  // `blocked` is display-derived now: coerce a stored blocked to in-progress
  // BEFORE deriving, so the derivation's in-progress eligibility gate fires for a
  // legacy stored-blocked item that IS covered by a risk. This mirrors
  // `applyBlockedRiskOverlay` on the head surface — the two MUST agree, else the
  // lead card and the head report disagree for identical data.
  const eligibleStatus: ItemStatus =
    item.status === "blocked" ? "in-progress" : item.status;
  const derivedAlarm =
    item.activityId == null && item.productId !== ""
      ? deriveItemAlarmFromRisks({ ...item, status: eligibleStatus }, risks)
      : null;
  const displayStatus: ItemStatus | "at-risk" = derivedAlarm ?? eligibleStatus;
  return {
    displayStatus,
    isBlocked: displayStatus === "blocked",
    isPlanned: displayStatus === "planned",
    alarmLocked: derivedAlarm !== null,
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
  readOnly = false,
  isEditing = false,
  onTextSave,
}: ItemCardProps) {
  const { displayStatus, isBlocked, isPlanned, alarmLocked } = deriveCardStatus(
    item,
    risks,
  );
  const badge =
    (STATUS_BADGE as Record<string, StatusBadge>)[displayStatus] ??
    STATUS_BADGE["in-progress"];
  const locked = readOnly || item.foreign === true;
  // Same gate as the render branch below — the style must track whichever
  // branch actually renders so an editable-but-locked card still gets the
  // fixed reference height instead of the edit-mode floor.
  const showEditor = isEditing && !locked;
  const stageTags = (
    item.stageIds && item.stageIds.length > 0
      ? item.stageIds
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(item.stageName)
  )
    // stage-label-canonicalization: heal a legacy short "Dev" at render so the
    // card reads the canonical "Development" alongside seeded rows; the pipeline
    // chip keeps its own short label.
    .map(canonicalStageName);
  // enforce-item-decision-stage-schema: a stage-less item is a legacy anomaly,
  // never an implicit "all stages" scope — render the loud "No stage set"
  // warning, mirroring the risk row.
  const stageTagsLabel =
    stageTags.length === 0 ? "No stage set" : stageTags.join(", ");
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
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span
            className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ background: badge.bg, color: badge.text }}
            title={
              alarmLocked
                ? "Status is set by the covering risk/blocker — resolve it to change."
                : undefined
            }
          >
            {badge.label}
          </span>
          {item.priorityRank != null && (
            <span
              role="img"
              className="inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: "var(--color-starbucks-gold)",
                color: "var(--color-primary-foreground)",
              }}
              aria-label={`Priority ${item.priorityRank}`}
              title={`Priority rank ${item.priorityRank}`}
            >
              P{item.priorityRank}
            </span>
          )}
          {publishedLocked && <PublishedRecordMarker />}
        </div>

        <ItemCardActions
          item={item}
          locked={locked}
          isEditing={isEditing}
          publishedLocked={publishedLocked}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkComplete={onMarkComplete}
          onMoveToNextWeek={onMoveToNextWeek}
        />
      </div>

      {/* Item text — editable when in edit mode, static otherwise. The
          textarea always shows the full, untruncated `item.text` (seeded
          into `draft`); only the static render below clamps. */}
      {showEditor ? (
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

      {/* Footer: author on the left, compact stage tags on the right.
          shrink-0 mirrors the top row — never compressed by the fixed
          height. */}
      <div className="mt-auto flex shrink-0 items-end justify-between gap-2 pt-2">
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
              // Warning tokens match the risk row's "no-stage-warning" chip
              // (#fef3c7 / #8a6d1b) so a stage-less item reads as an anomaly.
              <span className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold text-[#8a6d1b]">
                No stage set
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
