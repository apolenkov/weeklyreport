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

// Non-hit states (searching / failed / empty) share one polite live row.
function StatusRow({ children }: { readonly children: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
    >
      {children}
    </div>
  );
}

// Type badge on the left, created date on the right.
function SearchHitMetaRow({ hit }: { readonly hit: SearchHit }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {TYPE_BADGE[hit.type].label}
      </span>
      <span className="text-[11px] text-[var(--color-muted-foreground)]">
        {new Date(hit.createdAt).toLocaleDateString()}
      </span>
    </div>
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
  const url = targetUrlFor(hit, isViewer);
  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={isActive}
      onMouseEnter={() => onHoverHit(index)}
      onClick={() => onSelectHit(url)}
      className={`flex w-full flex-col gap-1 border-b border-[var(--color-border)] px-3 py-2 text-left transition-colors last:border-b-0 ${
        isActive
          ? "bg-[var(--color-success)]"
          : "bg-white hover:bg-[var(--color-success)]"
      }`}
    >
      <SearchHitMetaRow hit={hit} />
      <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">
        {hit.title}
      </div>
      <div className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
        {renderSnippet(hit.snippet)}
      </div>
    </button>
  );
}

/**
 * Search Results Dropdown.
 * @param props - The props argument.
 */
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
      {isFetching && hits.length === 0 && <StatusRow>Searching…</StatusRow>}

      {isError && <StatusRow>Search failed</StatusRow>}

      {showEmpty && <StatusRow>No results found</StatusRow>}

      {hits.map((hit, idx) => (
        <SearchHitOption
          key={`${hit.type}-${hit.id}`}
          hit={hit}
          optionId={`${resultsId}-option-${idx}`}
          index={idx}
          isActive={idx === activeIndex}
          isViewer={isViewer}
          onHoverHit={onHoverHit}
          onSelectHit={onSelectHit}
        />
      ))}
    </div>
  );
}
