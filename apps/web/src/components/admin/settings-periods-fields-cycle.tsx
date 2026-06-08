"use client";

import type { Dispatch, SetStateAction } from "react";

import type { MockSettings } from "./mock-data";

/**
 * UFB-051 (Phase 51-A) period-cycle fields for the Settings → Periods sub-tab,
 * extracted from `settings-tab.tsx` (R3a-4 max-lines split). These inputs
 * persist the AppSettings columns landed in migration
 * 20260510215245_period_model_expansion; consumers (cadence-aware
 * PeriodCreator, publish/reopen gating) ship in Phase 51-C — today the values
 * only round-trip.
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
      {/* ── firstDayOfWeek (UFB-051) ─────────────────────────────── */}
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
          First day of week
        </legend>
        <div className="flex gap-4">
          {(
            [
              { value: 1, label: "Monday (ISO)" },
              { value: 7, label: "Sunday" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
            >
              <input
                type="radio"
                name="first-day-of-week"
                value={opt.value}
                checked={draft.firstDayOfWeek === opt.value}
                onChange={() =>
                  setDraft({ ...draft, firstDayOfWeek: opt.value })
                }
                className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Anchor for «week N» labels and the weekly cadence start. ISO weekday
          numbering (1=Mon..7=Sun). Calendar-anchoring logic ships in Phase
          51-C.
        </p>
      </fieldset>

      {/* ── deadlineDayOfWeek (UFB-051) ──────────────────────────── */}
      <div>
        <label
          htmlFor="deadline-day-of-week"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Deadline day of week
        </label>
        <select
          id="deadline-day-of-week"
          name="deadline-day-of-week"
          value={draft.deadlineDayOfWeek}
          onChange={(e) =>
            setDraft({
              ...draft,
              deadlineDayOfWeek: Number.parseInt(e.target.value, 10) || 5,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <option value={1}>Monday</option>
          <option value={2}>Tuesday</option>
          <option value={3}>Wednesday</option>
          <option value={4}>Thursday</option>
          <option value={5}>Friday</option>
          <option value={6}>Saturday</option>
          <option value={7}>Sunday</option>
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Which day each period's deadline falls on. ISO numbering
          (1=Mon..7=Sun). Default Friday.
        </p>
      </div>

      {/* ── deadlineTime (UFB-051) ───────────────────────────────── */}
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
          HH:MM in the default timezone (Reminders tab). Default 18:00.
        </p>
      </div>

      {/* ── maxOpenPeriods (UFB-051) ─────────────────────────────── */}
      <div>
        <label
          htmlFor="max-open-periods"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Max open periods
        </label>
        <input
          id="max-open-periods"
          name="max-open-periods"
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          value={draft.maxOpenPeriods}
          onChange={(e) =>
            setDraft({
              ...draft,
              maxOpenPeriods: Math.max(
                1,
                Number.parseInt(e.target.value, 10) || 1,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Cap on simultaneously-open periods. PeriodCreator will skip
          auto-create when N periods are already open (51-C consumer).
        </p>
      </div>

      {/* ── requireAllSectionsToPublish (UFB-051) ────────────────── */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="require-all-sections-to-publish"
          type="checkbox"
          checked={draft.requireAllSectionsToPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              requireAllSectionsToPublish: e.target.checked,
            })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">
            Require all sections to publish
          </span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            When on, the head cannot publish until every lead has submitted.
            When off, missing sections render 'No submission' placeholder.
            Enforcement ships in Phase 51-C.
          </span>
        </span>
      </label>

      {/* ── allowReopenAfterPublish + reopenWindowHours (UFB-051) ─ */}
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
            Lets the head reopen a published period for late corrections. Window
            enforcement ships in Phase 51-C.
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
