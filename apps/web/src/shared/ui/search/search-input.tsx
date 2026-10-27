"use client";

import { useId } from "react";

import {
  type SearchController,
  useSearchController,
} from "./search-input-controller";
import { type SearchScope, searchScopeLabel } from "./search-input-utils";
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
  readonly onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
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
  onBlur,
  onValueChange,
  onKeyDown,
}: SearchComboboxProps) {
  return (
    <input
      id={inputId}
      name="search"
      type="search"
      role="combobox"
      aria-expanded={expanded}
      aria-controls={expanded ? resultsId : undefined}
      aria-activedescendant={activeOptionId}
      aria-autocomplete="list"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onFocus={onOpen}
      onBlur={onBlur}
      onChange={(e) => {
        onValueChange(e.target.value);
        onOpen();
      }}
      onKeyDown={onKeyDown}
      className="w-full min-h-[var(--touch-target-min)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:border-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)]"
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
  readonly label: string;
  readonly search: SearchViewState;
}

function SearchField({
  inputId,
  resultsId,
  expanded,
  placeholder,
  label,
  search,
}: SearchFieldProps) {
  const { q, setQ, setOpen, hits, activeIndex, handleKeyDown, handleBlur } =
    search;

  return (
    <>
      <label className="sr-only" htmlFor={inputId}>
        {label}
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
        onBlur={handleBlur}
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
    retry,
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
      onRetry={retry}
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
        label={searchScopeLabel(scope)}
        search={search}
      />
      {showResults && <SearchResults resultsId={resultsId} search={search} />}
    </div>
  );
}
