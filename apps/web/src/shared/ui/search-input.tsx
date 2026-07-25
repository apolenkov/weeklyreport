"use client";

import { useId } from "react";

import { useSearchController } from "./search-input-controller";
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
      className="w-full min-h-[var(--touch-target-min)] rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-success)]"
    />
  );
}

export function SearchInput({
  scope,
  placeholder,
  className,
}: SearchInputProps) {
  const reactId = useId().replaceAll(":", "");
  const inputId = `${reactId}-search-input`;
  const resultsId = `${reactId}-search-results`;

  const {
    q,
    setQ,
    open,
    setOpen,
    containerRef,
    enabled,
    hits,
    isError,
    isFetching,
    isViewer,
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    navigateTo,
  } = useSearchController(scope);

  const showResults = open && enabled;
  const activeOptionId =
    showResults && hits[activeIndex]
      ? `${resultsId}-option-${activeIndex}`
      : undefined;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <label className="sr-only" htmlFor={inputId}>
        Search Reports
      </label>
      <SearchCombobox
        inputId={inputId}
        resultsId={resultsId}
        activeOptionId={activeOptionId}
        expanded={showResults}
        value={q}
        placeholder={placeholder ?? "Search…"}
        onOpen={() => setOpen(true)}
        onValueChange={setQ}
        onKeyDown={handleKeyDown}
      />

      {showResults && (
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
      )}
    </div>
  );
}
