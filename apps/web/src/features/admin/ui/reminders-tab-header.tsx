"use client";

import { pluralize } from "../../../lib/pluralize";
import { PlusIcon } from "../../../shared/ui/icons";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";

interface RemindersTabHeaderProps {
  readonly policyCount: number;
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
  readonly onNewReminder: () => void;
}

export function RemindersTabHeader({
  policyCount,
  search,
  onSearchChange,
  onNewReminder,
}: RemindersTabHeaderProps) {
  return (
    <TabHeader
      title="Reminders"
      description="Each reminder fires automatically before every report deadline inside its validity window."
      count={`${policyCount} ${pluralize(policyCount, "reminder", "reminders")}`}
      search={
        <TabSearch
          value={search}
          onChange={onSearchChange}
          placeholder="Search reminders…"
          testId="reminders-search"
          ariaLabel="Search reminders"
        />
      }
      actions={
        <button
          type="button"
          onClick={onNewReminder}
          data-testid="new-policy-button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
        >
          <PlusIcon />
          New Reminder
        </button>
      }
    />
  );
}
