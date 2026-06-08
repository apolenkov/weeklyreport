"use client";

import type { SearchHit } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useTRPC } from "../../lib/trpc-context";

/**
 * 39-05 (PERF-05): full-text search input.
 *
 * Mounted in two places:
 *   - /lead/history sidebar with `scope='mine'` (lead's own content)
 *   - /admin?tab=products with `scope='all'` (head/admin only — server
 *     rejects 'all' for leads with FORBIDDEN)
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
type Scope = "mine" | "all";

interface SearchInputProps {
  readonly scope: Scope;
  readonly placeholder?: string;
  readonly className?: string;
}

const DEBOUNCE_MS = 300;
const MIN_LEN = 2;
const MAX_LEN = 200;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Resolve the click-through URL for a search hit.
 *
 * Phase 35-07 (UX-15) closed the migration: items/risks/decisions now
 * deep-link into the addressed lead form `/lead/report/<reportId>` with
 * the section anchor. Project hits deep-link to /admin?tab=products with
 * a filter query param.
 */
function targetUrlFor(hit: SearchHit): string {
  if (hit.type === "project") {
    return `/admin?tab=products&filter=${hit.id}`;
  }
  if (hit.reportId) {
    const anchor = hit.reportSectionId ? `#section-${hit.reportSectionId}` : "";
    return `/lead/report/${hit.reportId}${anchor}`;
  }
  return "#";
}

const TYPE_BADGE: Record<SearchHit["type"], { label: string; aria: string }> = {
  item: { label: "Task", aria: "Task match" },
  risk: { label: "Risk", aria: "Risk match" },
  decision: { label: "Decision", aria: "Decision match" },
  project: { label: "Product", aria: "Product match" },
};

/**
 * Render a snippet with `<<` / `>>` markers as <mark> elements. The
 * function returns a stable key for each chunk so React can reconcile
 * highlights across re-renders.
 */
function renderSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  const parts = snippet.split(/(<<[^>]*?>>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("<<") && part.endsWith(">>")) {
      const inner = part.slice(2, -2);
      return (
        <mark
          key={`m-${idx.toString()}`}
          className="rounded-[2px] bg-[var(--color-success)] px-[2px] text-[var(--color-foreground)]"
        >
          {inner}
        </mark>
      );
    }
    return <span key={`t-${idx.toString()}`}>{part}</span>;
  });
}

export function SearchInput({
  scope,
  placeholder,
  className,
}: SearchInputProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const reactId = useId().replaceAll(":", "");
  const inputId = `${reactId}-search-input`;
  const resultsId = `${reactId}-search-results`;

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQ = useDebouncedValue(q.trim(), DEBOUNCE_MS);

  const enabled = debouncedQ.length >= MIN_LEN && debouncedQ.length <= MAX_LEN;

  const { data, isError, isFetching } = useQuery({
    ...trpc.search.query.queryOptions({ q: debouncedQ, scope, limit: 20 }),
    enabled,
    staleTime: 30_000,
  });

  const hits = useMemo<readonly SearchHit[]>(() => data ?? [], [data]);

  // Reset selection when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [hits]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setQ("");
      setOpen(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      const hit = hits.at(activeIndex);
      if (hit) {
        e.preventDefault();
        setOpen(false);
        router.push(targetUrlFor(hit));
      }
    }
  }

  const showResults = open && enabled;
  const showError = showResults && isError;
  const showEmpty = showResults && !isError && !isFetching && hits.length === 0;
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

          {showError && (
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
            const url = targetUrlFor(hit);
            const date = new Date(hit.createdAt).toLocaleDateString();
            const badge = TYPE_BADGE[hit.type];
            return (
              <button
                key={`${hit.type}-${hit.id}`}
                id={`${resultsId}-option-${idx}`}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  setOpen(false);
                  router.push(url);
                }}
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
      )}
    </div>
  );
}
