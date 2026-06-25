"use client";

import type { Dispatch, SetStateAction } from "react";

import type { MockSettings } from "./mock-data";

/**
 * UFB-048 (Phase 48-B) period base fields for the Settings → Periods sub-tab,
 * extracted from `settings-tab.tsx` (R3a-4 max-lines split). The owning
 * `PeriodsSubTab` shell holds the draft state and Save button; this component
 * renders the field group and writes through the shared `setDraft`.
 */
export function PeriodBaseFields({
  draft,
  setDraft,
}: {
  readonly draft: MockSettings;
  readonly setDraft: Dispatch<SetStateAction<MockSettings>>;
}) {
  return (
    <>
      {/* ── periodLengthDays (UFB-048) ── */}
      <div>
        <label
          htmlFor="period-length-days"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Period length (days)
        </label>
        <input
          id="period-length-days"
          name="period-length-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={draft.periodLengthDays}
          onChange={(e) =>
            setDraft({
              ...draft,
              periodLengthDays: Number.parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          How many days each reporting period spans (default 7 = weekly).
        </p>
      </div>

      {/* ── workingDays (UFB-048) ── */}
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
          Working days
        </legend>
        <div className="flex flex-col gap-2">
          {(["mon-fri", "mon-sat", "mon-sun"] as const).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
            >
              <input
                type="radio"
                name="working-days"
                value={opt}
                checked={draft.workingDays === opt}
                onChange={() => setDraft({ ...draft, workingDays: opt })}
                className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
              />
              <span>
                {opt === "mon-fri" && "Mon-Fri (5-day week)"}
                {opt === "mon-sat" && "Mon-Sat (6-day week)"}
                {opt === "mon-sun" && "Mon-Sun (7-day week)"}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Feeds the deadline (business-day) calculation used when periods are
          created.
        </p>
      </fieldset>

      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="auto-create-periods"
          type="checkbox"
          checked={draft.autoCreatePeriods}
          onChange={(e) =>
            setDraft({ ...draft, autoCreatePeriods: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Auto-create periods</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Create the next reporting period automatically when the schedule
            advances.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="deadline-days"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Default deadline days
        </label>
        <input
          id="deadline-days"
          name="deadline-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={draft.defaultDeadlineDays}
          onChange={(e) =>
            setDraft({
              ...draft,
              defaultDeadlineDays: Number.parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Number of days after period start before reports are due.
        </p>
      </div>

      {/* ── gracePeriodHours (UFB-048) ── */}
      <div>
        <label
          htmlFor="grace-period-hours"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Grace period (hours)
        </label>
        <input
          id="grace-period-hours"
          name="grace-period-hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={168}
          value={draft.gracePeriodHours}
          onChange={(e) =>
            setDraft({
              ...draft,
              gracePeriodHours: Math.max(
                0,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Submissions within this many hours past the deadline are always
          accepted, regardless of «allow late submissions». Must be 0..168 (one
          week).
        </p>
      </div>

      {/* ── allowLateSubmissions (UFB-048) ── */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="allow-late-submissions"
          type="checkbox"
          checked={draft.allowLateSubmissions}
          onChange={(e) =>
            setDraft({ ...draft, allowLateSubmissions: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Allow late submissions</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Governs only what happens AFTER the grace window. When on,
            submissions are still accepted past the grace window. When off,
            submissions past deadline + grace are rejected.
          </span>
        </span>
      </label>

      {/* ── autoPublishAfterDeadline (UFB-048) ── */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="auto-publish-after-deadline"
          type="checkbox"
          checked={draft.autoPublishAfterDeadline}
          onChange={(e) =>
            setDraft({ ...draft, autoPublishAfterDeadline: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Auto-publish after deadline</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            When on, the hourly auto-publisher publishes any still-draft period
            once <code>deadline + grace</code> has passed (at the next top of
            the hour); sections leads never submitted appear empty in the
            published report. Independent of «Auto-create periods».
          </span>
        </span>
      </label>

      {/* ── autoArchiveWeeksAfterPublish (UFB-048) ── */}
      <div>
        <label
          htmlFor="auto-archive-weeks"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Auto-archive published periods after (weeks)
        </label>
        <input
          id="auto-archive-weeks"
          name="auto-archive-weeks"
          type="number"
          inputMode="numeric"
          min={0}
          max={52}
          value={draft.autoArchiveWeeksAfterPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              autoArchiveWeeksAfterPublish: Math.max(
                0,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          0 = never archive. Otherwise: a published period drops out of the
          default «active» views after N weeks.
        </p>
      </div>
    </>
  );
}
