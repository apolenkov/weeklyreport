import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import {
  segmentClassName,
  SegmentedToggle,
} from "../report-shell/segmented-toggle";
import { authorSlotBackground } from "./slide-article-rows";
import type {
  GridAuthor,
  SlideGridModel,
  SlideTrafficStatus,
} from "./slide-grid-model";

export type SlideViewMode = "summary" | "product";

const WORST_PILL: Record<
  Exclude<SlideTrafficStatus, null> | "none",
  {
    readonly label: string;
    readonly className: string;
    readonly alert: boolean;
  }
> = {
  red: {
    label: "Blockers",
    className:
      "bg-[var(--color-chip-blocked-bg)] text-[var(--color-destructive)] border-[var(--color-chip-blocked-border)]",
    alert: true,
  },
  yellow: {
    label: "At risk",
    className:
      "bg-[var(--color-chip-at-risk-bg)] text-[var(--color-chip-at-risk-text)] border-[var(--color-chip-at-risk-border)]",
    alert: true,
  },
  green: {
    label: "On track",
    className:
      "bg-[var(--color-chip-on-track-bg)] text-[var(--color-chip-on-track-text)] border-[var(--color-chip-on-track-border)]",
    alert: false,
  },
  none: {
    label: "No status",
    className:
      "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
    alert: false,
  },
};

function metric(count: number, label: string) {
  return (
    <span
      key={label}
      className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]"
    >
      <span className="text-sm font-bold text-[var(--color-foreground)]">
        {count}
      </span>{" "}
      {label}
    </span>
  );
}

/** Slide header: worst-status pill, owner name, counters, the "N of M products
 * on track" chip (alert tint while N < M), and the Summary/Product toggle. */
export function SlideGridHeader({
  ownerName,
  grid,
  mode,
  onModeChange,
  heroControls,
}: {
  readonly ownerName: string;
  readonly grid: SlideGridModel;
  readonly mode: SlideViewMode;
  readonly onModeChange: (mode: SlideViewMode) => void;
  /** Deck-owned controls (fullscreen, period picker) rendered after the toggle. */
  readonly heroControls?: ReactNode;
}) {
  const pill = WORST_PILL[grid.worstStatus ?? "none"];
  const short = grid.onTrack.on < grid.onTrack.total;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(0,0,0,0.08)] pb-3">
      <span
        className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold ${pill.className}`}
      >
        {pill.alert && (
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {pill.label}
      </span>
      <h2 className="min-w-0 truncate text-xl font-semibold text-[var(--color-foreground)]">
        {ownerName}
      </h2>
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
      <SegmentedToggle ariaLabel="Slide view mode">
        {(["summary", "product"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            className={segmentClassName(mode === value)}
            onClick={() => {
              onModeChange(value);
            }}
          >
            {value === "summary" ? "Summary" : "Product"}
          </button>
        ))}
      </SegmentedToggle>
      {heroControls}
    </div>
  );
}

/** Frameless row of priority cards — every own ranked item, ascending rank. */
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
      {grid.priorityStrip.map((card) => {
        const author = authorsById.get(card.authorId);
        return (
          <div
            key={card.id}
            className="flex min-w-[180px] max-w-[320px] flex-1 flex-col gap-1.5 rounded-[10px] border border-[var(--color-chip-at-risk-border)] bg-[var(--color-chip-at-risk-bg)] p-2.5"
          >
            <div className="flex items-start gap-1.5">
              <span
                className="inline-flex h-[15px] shrink-0 items-center rounded px-1 text-[8px] font-semibold text-white"
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
                  className="inline-flex h-[15px] w-[22px] shrink-0 items-center justify-center rounded text-[8px] font-semibold text-white"
                  style={{ background: authorSlotBackground(author) }}
                >
                  {author.initials}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Footer legend: every author on the slide with initials badge, name and an
 * optional role — the suffix is omitted entirely when the role is unknown. */
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
            className="inline-flex h-[15px] w-[22px] items-center justify-center rounded text-[8px] font-semibold text-white"
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
