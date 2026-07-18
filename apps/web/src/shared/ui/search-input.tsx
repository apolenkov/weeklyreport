"use client";

import { useId } from "react";

import { useSearchController } from "./search-input-controller";
import type { SearchScope } from "./search-input-utils";
import { SearchResultsDropdown } from "./search-results-dropdown";

/**
 * Full-text search input.
 *
 * Mounted in three places:
 *   - /reports (lead) sidebar with `scope='mine'` (lead's own content)
 *   - /reports (head/admin) with `scope='all'` (server rejects 'all' for leads)
 *   - /reports (viewer) with `scope='published'` (viewer-report-surface-parity):
 *     published, group-scoped content only; project hits are excluded and
 *     item/risk/decision hits route to the read-only `/reports/[reportId]`.
 *
 * Behaviour:
 *   - Debounces the input by 300ms before firing the tRPC query.
 *   - Only fires when q.length >= 2 (matches the spec floor).
 *   - Renders a results dropdown directly below the input.
 *   - Keyboard: Esc clears, ↑/↓ navigates, Enter activates highlighted hit.
 *   - Click on a hit → next/router.push to the source. Items / risks /
 *     decisions land on `/lead/report/<reportId>` with hash anchor; project
 *     hits go to `/admin?tab=products&filter=<projectId>`.
 *
 * Snippet rendering: the server returns `<<…>>` markers from ts_headline.
 * The client splits on those markers and wraps the matched tokens in a
 * <mark> element. We split on the literal markers (not regex) because the
 * markers are server-controlled and can't be confused with user text.
 */
interface SearchInputProps {
  readonly scope: SearchScope;
  readonly placeholder?: string;
  readonly className?: string;
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
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showResults}
        aria-controls={resultsId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        autoComplete="off"
        value={q}
        placeholder={placeholder ?? "Search…"}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[var(--touch-target-min)] rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-success)]"
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
