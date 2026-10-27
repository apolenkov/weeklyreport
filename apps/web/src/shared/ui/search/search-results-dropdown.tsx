import type { SearchHit } from "@weeklyreport/shared";
import { type ReactNode, useEffect } from "react";

import { formatDateWithYear } from "../../lib/format/format-date";
import {
  renderSnippet,
  searchOptionId,
  targetUrlFor,
  TYPE_BADGE,
} from "./search-input-utils";

export interface SearchResultsDropdownProps {
  readonly resultsId: string;
  readonly hits: readonly SearchHit[];
  readonly activeIndex: number;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isViewer: boolean;
  readonly onRetry: () => void;
  readonly onHoverHit: (idx: number) => void;
  readonly onSelectHit: (url: string) => void;
}

// Non-hit states (searching / failed / empty) share one polite live row.
function StatusRow({
  children,
  loading = false,
  actionLabel,
  onAction,
}: {
  readonly children: ReactNode;
  readonly loading?: boolean;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={loading ? "true" : undefined}
      aria-label={loading ? "Searching reports" : undefined}
      className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
    >
      <span>{children}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="ml-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

// Type badge on the left, created date on the right.
function SearchHitMetaRow({ hit }: { readonly hit: SearchHit }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {TYPE_BADGE[hit.type].label}
      </span>
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {formatDateWithYear(new Date(hit.createdAt))}
      </span>
    </div>
  );
}

function SearchHitContent({ hit }: { readonly hit: SearchHit }) {
  return (
    <>
      <SearchHitMetaRow hit={hit} />
      <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">
        {hit.title}
      </div>
      <div className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
        {renderSnippet(hit.snippet)}
      </div>
    </>
  );
}

function SearchHitOption({
  hit,
  optionId,
  index,
  isActive,
  isViewer,
  onHoverHit,
  onSelectHit,
}: {
  readonly hit: SearchHit;
  readonly optionId: string;
  readonly index: number;
  readonly isActive: boolean;
  readonly isViewer: boolean;
  readonly onHoverHit: (idx: number) => void;
  readonly onSelectHit: (url: string) => void;
}) {
  const target = targetUrlFor(hit, isViewer);
  if (target.kind === "unavailable") {
    return (
      <button
        id={optionId}
        type="button"
        role="option"
        aria-selected={false}
        disabled
        title="Destination unavailable"
        className="flex w-full flex-col gap-1 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SearchHitContent hit={hit} />
      </button>
    );
  }
  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={isActive}
      // The combobox owns the keyboard: Tab leaves the whole popup instead of
      // walking its options, so the input stays the only stop.
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => onHoverHit(index)}
      onClick={() => onSelectHit(target.url)}
      className={`flex w-full flex-col gap-1 border-b border-[var(--color-border)] px-3 py-2 text-left transition-colors last:border-b-0 ${
        isActive
          ? "bg-[var(--color-success)]"
          : "bg-[var(--color-card)] hover:bg-[var(--color-success)]"
      }`}
    >
      <SearchHitContent hit={hit} />
    </button>
  );
}

// The combobox keeps focus (aria-activedescendant), so the popup reveals its own
// active option; "nearest" leaves hover and already-visible options still.
function useRevealActiveOption(resultsId: string, activeIndex: number): void {
  useEffect(() => {
    document
      .getElementById(searchOptionId(resultsId, activeIndex))
      ?.scrollIntoView({ block: "nearest" });
  }, [resultsId, activeIndex]);
}

export function SearchResultsDropdown({
  resultsId,
  hits,
  activeIndex,
  isError,
  isFetching,
  isViewer,
  onRetry,
  onHoverHit,
  onSelectHit,
}: SearchResultsDropdownProps) {
  const showEmpty = !isError && !isFetching && hits.length === 0;
  useRevealActiveOption(resultsId, activeIndex);

  return (
    <div
      tabIndex={-1}
      className="absolute z-[var(--layer-popover)] mt-1 max-h-[420px] w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg"
    >
      {isFetching && <StatusRow loading>Searching…</StatusRow>}

      {isError && (
        <StatusRow actionLabel="Try again" onAction={onRetry}>
          Search failed
        </StatusRow>
      )}

      {showEmpty && (
        <StatusRow>
          <span>No results found</span>
          <span className="ml-1">Try a different search.</span>
        </StatusRow>
      )}

      <div id={resultsId} role="listbox" aria-label="Search results">
        {hits.map((hit, idx) => (
          <SearchHitOption
            key={`${hit.type}-${hit.id}`}
            hit={hit}
            optionId={searchOptionId(resultsId, idx)}
            index={idx}
            isActive={idx === activeIndex}
            isViewer={isViewer}
            onHoverHit={onHoverHit}
            onSelectHit={onSelectHit}
          />
        ))}
      </div>
    </div>
  );
}
