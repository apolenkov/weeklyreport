"use client";

import type { Dispatch, SetStateAction } from "react";

import type { MockSettings } from "../../admin";

/**
 * Period-cycle fields for the Settings → Periods sub-tab. Each field here has a
 * live consumer: `deadlineTime` is the manual-creation deadline default;
 * `allowReopenAfterPublish` + `reopenWindowHours` gate the reopen request path
 * (`period.service`).
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
      {/* ── deadlineTime ─────────────────────────────────────────── */}
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
            setDraft({ ...draft, deadlineTime: e.target.value || "18:00" })
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

      {/* ── allowReopenAfterPublish + reopenWindowHours ──────────── */}
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
          min={0}
          max={168}
          disabled={!draft.allowReopenAfterPublish}
          value={draft.reopenWindowHours}
          onChange={(e) =>
            setDraft({
              ...draft,
              reopenWindowHours: Math.max(
                0,
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
