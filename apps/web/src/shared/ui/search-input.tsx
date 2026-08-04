"use client";

import { useId } from "react";

import {
  type SearchController,
  useSearchController,
} from "./search-input-controller";
import type { SearchScope } from "./search-input-utils";
import { SearchResultsDropdown } from "./search-results-dropdown";

interface SearchInputProps {
  readonly scope: SearchScope;
  readonly placeholder?: string;
  readonly className?: string;
}

interface SearchComboboxProps {
  readonly inputId: string;
  readonly resultsId: string;
  readonly activeOptionId: string | undefined;
  readonly expanded: boolean;
  readonly value: string;
  readonly placeholder: string;
  readonly onOpen: () => void;
  readonly onValueChange: (next: string) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function SearchCombobox({
  inputId,
  resultsId,
  activeOptionId,
  expanded,
  value,
  placeholder,
  onOpen,
  onValueChange,
  onKeyDown,
}: SearchComboboxProps) {
  return (
    <input
      id={inputId}
      type="search"
      role="combobox"
      aria-expanded={expanded}
      aria-controls={resultsId}
      aria-activedescendant={activeOptionId}
      aria-autocomplete="list"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onFocus={onOpen}
      onChange={(e) => {
        onValueChange(e.target.value);
        onOpen();
      }}
      onKeyDown={onKeyDown}
      className="w-full min-h-[var(--touch-target-min)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-success)]"
    />
  );
}

function useSearchFieldIds() {
  const reactId = useId().replaceAll(":", "");
  return {
    inputId: `${reactId}-search-input`,
    resultsId: `${reactId}-search-results`,
  };
}

// The container owns `containerRef`; the presentational parts never see it, so
// nothing reads a ref during render.
type SearchViewState = Omit<SearchController, "containerRef">;

interface SearchFieldProps {
  readonly inputId: string;
  readonly resultsId: string;
  readonly expanded: boolean;
  readonly placeholder: string;
  readonly search: SearchViewState;
}

function SearchField({
  inputId,
  resultsId,
  expanded,
  placeholder,
  search,
}: SearchFieldProps) {
  const { q, setQ, setOpen, hits, activeIndex, handleKeyDown } = search;

  return (
    <>
      <label className="sr-only" htmlFor={inputId}>
        Search Reports
      </label>
      <SearchCombobox
        inputId={inputId}
        resultsId={resultsId}
        activeOptionId={
          expanded && hits[activeIndex]
            ? `${resultsId}-option-${activeIndex}`
            : undefined
        }
        expanded={expanded}
        value={q}
        placeholder={placeholder}
        onOpen={() => setOpen(true)}
        onValueChange={setQ}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}

function SearchResults({
  resultsId,
  search,
}: {
  readonly resultsId: string;
  readonly search: SearchViewState;
}) {
  const {
    hits,
    activeIndex,
    isError,
    isFetching,
    isViewer,
    setActiveIndex,
    navigateTo,
  } = search;

  return (
    <SearchResultsDropdown
      resultsId={resultsId}
      hits={hits}
      activeIndex={activeIndex}
      isError={isError}
      isFetching={isFetching}
      isViewer={isViewer}
      onHoverHit={setActiveIndex}
      onSelectHit={navigateTo}
    />
  );
}

export function SearchInput({
  scope,
  placeholder,
  className,
}: SearchInputProps) {
  const { inputId, resultsId } = useSearchFieldIds();
  const { containerRef, ...search } = useSearchController(scope);
  const showResults = search.open && search.enabled;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <SearchField
        inputId={inputId}
        resultsId={resultsId}
        expanded={showResults}
        placeholder={placeholder ?? "Search…"}
        search={search}
      />
      {showResults && <SearchResults resultsId={resultsId} search={search} />}
    </div>
  );
}
