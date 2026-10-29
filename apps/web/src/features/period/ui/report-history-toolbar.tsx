"use client";

import type { Role } from "@weeklyreport/shared";
import { Archive } from "lucide-react";

import { SearchInput } from "../../../shared/ui/search/search-input";
import {
  historySearchPlaceholder,
  historySearchScope,
} from "../model/report-history-role";

function HistoryArchiveToggle({
  checked,
  archiveCount,
  onChange,
}: {
  readonly checked: boolean;
  readonly archiveCount: number;
  readonly onChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center">
      <label
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-card)] px-3 text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] hover:text-[var(--color-starbucks-accent)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]"
        title="Past weeks and closed reports"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
          aria-label={
            archiveCount > 0
              ? `Show archived reports (${archiveCount})`
              : "Show archived reports"
          }
        />
        <Archive className="h-4 w-4" aria-hidden="true" />
        <span>Show archived{archiveCount > 0 ? ` (${archiveCount})` : ""}</span>
      </label>
    </div>
  );
}

// Before the session resolves the resolved frame renders invisible and inert, so
// its height and narrow-width wrap match the loaded toolbar.
export function HistoryToolbar({
  role,
  includeArchive,
  archiveCount,
  onArchiveChange,
}: {
  readonly role: Role | null;
  readonly includeArchive: boolean;
  readonly archiveCount: number;
  readonly onArchiveChange: (nextValue: boolean) => void;
}) {
  const searchScope = historySearchScope(role);
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-card)_75%,transparent)] px-3 py-3${role ? "" : " invisible"}`}
      aria-hidden={role ? undefined : true}
      inert={role ? undefined : true}
    >
      <div className="min-h-[var(--touch-target-min)] min-w-[220px] flex-1">
        {searchScope ? (
          <SearchInput
            scope={searchScope}
            placeholder={historySearchPlaceholder(role)}
          />
        ) : null}
      </div>
      <HistoryArchiveToggle
        checked={includeArchive}
        archiveCount={archiveCount}
        onChange={onArchiveChange}
      />
    </div>
  );
}
