"use client";

import type { ReactNode } from "react";

/**
 * UFB-026 / UFB-029: shared header for every admin tab so users / groups /
 * products / periods / reminders / reopen / jobs / actions / settings all
 * share the same shape: title + description + count badge on the left,
 * search input + actions on the right.
 *
 * Tabs that don't need search or actions just omit those slots; the layout
 * still aligns visually because the row is a single flex container with a
 * consistent gap.
 */
export interface TabHeaderProps {
  readonly title: string;
  readonly description?: string;
  /** Optional count chip rendered next to the title (e.g. "12 users"). */
  readonly count?: ReactNode;
  /** Right-rail search input. Pass a controlled `<input>` or skip. */
  readonly search?: ReactNode;
  /** Right-rail action buttons (Add new, Refresh, etc.). */
  readonly actions?: ReactNode;
  /** data-testid for E2E. Defaults to derived "<title>-tab-header". */
  readonly testId?: string;
}

export function TabHeader({
  title,
  description,
  count,
  search,
  actions,
  testId,
}: TabHeaderProps) {
  const resolvedTestId =
    testId ?? `${title.toLowerCase().replaceAll(/\s+/g, "-")}-tab-header`;
  return (
    <header
      data-testid={resolvedTestId}
      className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
            {title}
          </h2>
          {count !== undefined && count !== null ? (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[12px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {(search || actions) && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          {search}
          {actions}
        </div>
      )}
    </header>
  );
}

/**
 * Convenience search input that matches the canonical admin-tab search
 * styling. Wrapping in a stable component keeps every tab visually aligned
 * without each one re-styling the input.
 */
export interface TabSearchProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder?: string;
  readonly testId?: string;
  readonly ariaLabel?: string;
}

export function TabSearch({
  value,
  onChange,
  placeholder,
  testId,
  ariaLabel,
}: TabSearchProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search…"}
      data-testid={testId}
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      className="min-h-[var(--touch-target-min)] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] sm:w-64"
    />
  );
}

/**
 * A3: Quick-filter select — drop-in complement to TabSearch for admin tabs
 * that need a categorical dimension filter (e.g. role, status, group).
 * Options include a sentinel "All" entry with value "".
 */
export interface TabFilterOption {
  readonly value: string;
  readonly label: string;
}

export interface TabFilterProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly options: readonly TabFilterOption[];
  readonly testId?: string;
  readonly ariaLabel?: string;
}

export function TabFilter({
  value,
  onChange,
  options,
  testId,
  ariaLabel,
}: TabFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      aria-label={ariaLabel ?? "Filter"}
      className="select-chevron min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white py-1.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
