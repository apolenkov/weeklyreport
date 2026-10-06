"use client";

import type { ReactNode } from "react";

export interface TabHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly count?: ReactNode;
  readonly search?: ReactNode;
  readonly actions?: ReactNode;
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
      className="flex flex-col items-stretch gap-3 xl:flex-row xl:items-start xl:justify-between"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-title">{title}</h2>
          {count !== undefined && count !== null ? (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[12px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="max-w-[65ch] text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {(search || actions) && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3 xl:flex-nowrap">
          {search}
          {actions}
        </div>
      )}
    </header>
  );
}

export interface TabSearchProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder?: string;
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

export function TabSearch({
  value,
  onChange,
  placeholder,
  testId,
  ariaLabel,
  disabled = false,
}: TabSearchProps) {
  return (
    <input
      type="search"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search…"}
      data-testid={testId}
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      className="min-h-[var(--touch-target-min)] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
    />
  );
}

interface TabFilterOption {
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
      className="select-chevron min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
