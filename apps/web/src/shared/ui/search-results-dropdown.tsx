import type { SearchHit } from "@customreport/shared";

import { renderSnippet, targetUrlFor, TYPE_BADGE } from "./search-input-utils";

export interface SearchResultsDropdownProps {
  readonly resultsId: string;
  readonly hits: readonly SearchHit[];
  readonly activeIndex: number;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isViewer: boolean;
  readonly onHoverHit: (idx: number) => void;
  readonly onSelectHit: (url: string) => void;
}

/** Listbox rows: loading/error/empty states plus the hit list with badge + snippet. */
export function SearchResultsDropdown({
  resultsId,
  hits,
  activeIndex,
  isError,
  isFetching,
  isViewer,
  onHoverHit,
  onSelectHit,
}: SearchResultsDropdownProps) {
  const showEmpty = !isError && !isFetching && hits.length === 0;

  return (
    <div
      id={resultsId}
      role="listbox"
      className="absolute z-50 mt-1 max-h-[420px] w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-white shadow-lg"
    >
      {isFetching && hits.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
        >
          Searching…
        </div>
      )}

      {isError && (
        <div
          role="status"
          aria-live="polite"
          className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
        >
          Search failed
        </div>
      )}

      {showEmpty && (
        <div
          role="status"
          aria-live="polite"
          className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
        >
          No results found
        </div>
      )}

      {hits.map((hit, idx) => {
        const isActive = idx === activeIndex;
        const url = targetUrlFor(hit, isViewer);
        const date = new Date(hit.createdAt).toLocaleDateString();
        const badge = TYPE_BADGE[hit.type];
        return (
          <button
            key={`${hit.type}-${hit.id}`}
            id={`${resultsId}-option-${idx}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={() => onHoverHit(idx)}
            onClick={() => onSelectHit(url)}
            className={`flex w-full flex-col gap-1 border-b border-[var(--color-border)] px-3 py-2 text-left transition-colors last:border-b-0 ${
              isActive
                ? "bg-[var(--color-success)]"
                : "bg-white hover:bg-[var(--color-success)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {badge.label}
              </span>
              <span className="text-[11px] text-[var(--color-muted-foreground)]">
                {date}
              </span>
            </div>
            <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {hit.title}
            </div>
            <div className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
              {renderSnippet(hit.snippet)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
