"use client";

import type { Dispatch, SetStateAction } from "react";

import type { MockSettings } from "../../admin";

// Empty time inputs resolve here — matches auto-create's fixed 18:00 default.
const DEFAULT_DEADLINE_TIME = "18:00";

// Same 0..168 (one week) bound used for grace-period hours.
const REOPEN_WINDOW_HOURS_MIN = 0;
const REOPEN_WINDOW_HOURS_MAX = 168;

// Live consumers: deadlineTime (manual-create default), allowReopenAfterPublish
// + reopenWindowHours (period.service reopen gate).
/**
 * Period Cycle Fields.
 * @param options - The options argument.
 */
export function PeriodCycleFields({
  draft,
  setDraft,
}: {
  readonly draft: MockSettings;
  readonly setDraft: Dispatch<SetStateAction<MockSettings>>;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="deadline-time"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Deadline time
        </label>
        <input
          id="deadline-time"
          name="deadline-time"
          type="time"
          step={60}
          value={draft.deadlineTime}
          onChange={(e) =>
            setDraft({
              ...draft,
              deadlineTime: e.target.value || DEFAULT_DEADLINE_TIME,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Default deadline time for manually created periods, applied at
          whole-hour precision (minutes are ignored). HH:MM in the default
          timezone (Reminders tab). Automatic period creation currently uses a
          fixed 18:00.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="allow-reopen-after-publish"
          type="checkbox"
          checked={draft.allowReopenAfterPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              allowReopenAfterPublish: e.target.checked,
            })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Allow reopen after publish</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Lets the head reopen a published period for late corrections. When
            off, the reopen request is rejected.
          </span>
        </span>
      </label>

      <div
        className={
          draft.allowReopenAfterPublish ? "" : "pointer-events-none opacity-60"
        }
      >
        <label
          htmlFor="reopen-window-hours"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Reopen window (hours)
        </label>
        <input
          id="reopen-window-hours"
          name="reopen-window-hours"
          type="number"
          inputMode="numeric"
          min={REOPEN_WINDOW_HOURS_MIN}
          max={REOPEN_WINDOW_HOURS_MAX}
          disabled={!draft.allowReopenAfterPublish}
          value={draft.reopenWindowHours}
          onChange={(e) =>
            setDraft({
              ...draft,
              reopenWindowHours: Math.max(
                REOPEN_WINDOW_HOURS_MIN,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          How long after publish a period can still be reopened. 0..168 (one
          week). Greyed out when «allow reopen» is off.
        </p>
      </div>
    </>
  );
}
