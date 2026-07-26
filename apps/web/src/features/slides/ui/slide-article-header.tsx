import { trafficLightToCanonical } from "@customreport/shared";
import type { ReactNode } from "react";

import type {
  GridAuthor,
  GridPriorityCard,
  SlideGridModel,
} from "../model/slide-grid-model";
import { authorSlotBackground } from "./slide-article-rows";
import { SlideStatusBadge } from "./slide-status-badge";

function metric(count: number, label: string) {
  return (
    <span
      key={label}
      className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]"
    >
      <span className="text-sm font-bold tabular-nums text-[var(--color-foreground)]">
        {count}
      </span>{" "}
      {label}
    </span>
  );
}

// Slide header: worst-status pill, owner name, counters, and the "N of M
// products on track" chip (alert tint while N < M).
export function SlideGridHeader({
  ownerName,
  grid,
  heroControls,
  pageLabel,
}: {
  readonly ownerName: string;
  readonly grid: SlideGridModel;
  /** Deck-owned controls (fullscreen, period picker) rendered at the end. */
  readonly heroControls?: ReactNode;
  readonly pageLabel?: string;
}) {
  const short = grid.onTrack.on < grid.onTrack.total;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(0,0,0,0.08)] pb-3">
      <SlideStatusBadge
        status={trafficLightToCanonical(grid.worstStatus)}
        labelVariant="worstPill"
      />
      <h2 className="min-w-0 truncate text-xl font-semibold text-[var(--color-foreground)]">
        {ownerName}
      </h2>
      {pageLabel ? (
        <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">
          {pageLabel}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        {metric(grid.counters.current, "current")}
        <span aria-hidden="true">·</span>
        {metric(grid.counters.risks, "risks")}
        <span aria-hidden="true">·</span>
        {metric(grid.counters.priorities, "priorities")}
      </span>
      {grid.onTrack.total > 0 && (
        <span
          data-testid="slide-on-track-chip"
          className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${
            short
              ? "bg-[var(--color-chip-blocked-bg)] text-[var(--color-destructive)]"
              : "bg-[var(--color-chip-on-track-bg)] text-[var(--color-chip-on-track-text)]"
          }`}
        >
          {grid.onTrack.on} of {grid.onTrack.total} products on track
        </span>
      )}
      {heroControls}
    </div>
  );
}

function PriorityCard({
  card,
  author,
}: {
  readonly card: GridPriorityCard;
  readonly author: GridAuthor | undefined;
}) {
  return (
    <div className="flex min-w-[180px] max-w-[320px] flex-1 flex-col gap-1.5 rounded-[10px] border border-[var(--color-chip-at-risk-border)] bg-[var(--color-chip-at-risk-bg)] p-2.5">
      <div className="flex items-start gap-1.5">
        {/* The rank badge wears its author's identity color, answering
            "whose priority" at a glance; pastel backgrounds need the
            dark foreground text, never white. */}
        <span
          className="inline-flex h-[15px] shrink-0 items-center rounded px-1 text-[8px] font-semibold text-[var(--color-foreground)]"
          style={
            author === undefined
              ? undefined
              : { background: authorSlotBackground(author) }
          }
        >
          P{card.rank}
        </span>
        <span className="min-w-0 whitespace-normal break-words text-xs text-[var(--color-foreground)]">
          {card.text}
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[var(--color-muted-foreground)]">
          {card.productName}
        </span>
        {author !== undefined && (
          <span
            title={author.name}
            className="inline-flex h-[15px] w-[22px] shrink-0 items-center justify-center rounded text-[8px] font-semibold text-[var(--color-foreground)]"
            style={{ background: authorSlotBackground(author) }}
          >
            <span aria-hidden="true">{author.initials}</span>
            <span className="sr-only">{author.name}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// Frameless row of priority cards — every own ranked item, ascending rank.
export function SlidePriorityStrip({
  grid,
  authorsById,
}: {
  readonly grid: SlideGridModel;
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
}) {
  if (grid.priorityStrip.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="slide-priority-strip">
      {grid.priorityStrip.map((card) => (
        <PriorityCard
          key={card.id}
          card={card}
          author={authorsById.get(card.authorId)}
        />
      ))}
    </div>
  );
}

// Footer legend: every author on the slide with initials badge, name and an
// optional role — the suffix is omitted entirely when the role is unknown.
export function SlideLegend({
  authors,
}: {
  readonly authors: readonly GridAuthor[];
}) {
  return (
    <div
      data-testid="slide-legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[rgba(0,0,0,0.08)] pt-2 text-[10px] text-[var(--color-muted-foreground)]"
    >
      {authors.map((author) => (
        <span key={author.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-flex h-[15px] w-[22px] items-center justify-center rounded text-[8px] font-semibold text-[var(--color-foreground)]"
            style={{ background: authorSlotBackground(author) }}
          >
            {author.initials}
          </span>
          {author.name}
          {author.role === undefined ? "" : ` · ${author.role}`}
        </span>
      ))}
    </div>
  );
}
