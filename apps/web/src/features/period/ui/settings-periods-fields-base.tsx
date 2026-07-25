"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { MockSettings } from "../../admin";
import * as fieldLimits from "./settings-periods-fields-base-helpers";

const NUMBER_INPUT_CLASS =
  "w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_HINT_CLASS = "mt-1 text-xs text-[var(--color-muted-foreground)]";
const TOGGLE_CARD_CLASS =
  "flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]";

interface NumberFieldBounds {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

// Integer field clamped to its declared bounds on every keystroke, so the draft
// never holds a value the API would reject.
function NumberField({
  id,
  label,
  bounds,
  value,
  onChange,
  hint,
}: {
  readonly id: string;
  readonly label: string;
  readonly bounds: NumberFieldBounds;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly hint: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={bounds.min}
        max={bounds.max}
        value={value}
        onChange={(e) =>
          onChange(fieldLimits.boundedInteger(e.target.value, bounds))
        }
        className={NUMBER_INPUT_CLASS}
      />
      <p className={FIELD_HINT_CLASS}>{hint}</p>
    </div>
  );
}

// Checkbox card: the whole card is the label, so the description is clickable.
function ToggleField({
  name,
  title,
  description,
  checked,
  onChange,
}: {
  readonly name: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className={TOGGLE_CARD_CLASS}>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
      />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">
          {description}
        </span>
      </span>
    </label>
  );
}

const WORKING_DAY_OPTIONS = [
  { value: "mon-fri", label: "Mon-Fri (5-day week)" },
  { value: "mon-sat", label: "Mon-Sat (6-day week)" },
  { value: "mon-sun", label: "Mon-Sun (7-day week)" },
] as const;

function WorkingDaysField({
  value,
  onChange,
}: {
  readonly value: MockSettings["workingDays"];
  readonly onChange: (value: MockSettings["workingDays"]) => void;
}) {
  return (
    <fieldset>
      <legend className={FIELD_LABEL_CLASS}>Working days</legend>
      <div className="flex flex-col gap-2">
        {WORKING_DAY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
          >
            <input
              type="radio"
              name="working-days"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <p className={FIELD_HINT_CLASS}>
        Feeds the deadline (business-day) calculation used when periods are
        created.
      </p>
    </fieldset>
  );
}

interface FieldGroupProps {
  readonly draft: MockSettings;
  readonly setDraft: Dispatch<SetStateAction<MockSettings>>;
}

// Shell owns draft/Save; this component only renders the field group.
export function PeriodBaseFields({ draft, setDraft }: FieldGroupProps) {
  return (
    <>
      <PeriodShapeFields draft={draft} setDraft={setDraft} />
      <SubmissionWindowFields draft={draft} setDraft={setDraft} />
      <PublicationFields draft={draft} setDraft={setDraft} />
    </>
  );
}

// When a period starts, how long it runs, and whether the next one is created
// automatically.
function PeriodShapeFields({ draft, setDraft }: FieldGroupProps) {
  return (
    <>
      <NumberField
        id="period-length-days"
        label="Period length (days)"
        bounds={fieldLimits.PERIOD_LENGTH_DAYS}
        value={draft.periodLengthDays}
        onChange={(periodLengthDays) =>
          setDraft({ ...draft, periodLengthDays })
        }
        hint="How many days each reporting period spans (default 7 = weekly)."
      />

      <WorkingDaysField
        value={draft.workingDays}
        onChange={(workingDays) => setDraft({ ...draft, workingDays })}
      />

      <ToggleField
        name="auto-create-periods"
        title="Auto-create periods"
        description="Create the next reporting period automatically when the schedule advances."
        checked={draft.autoCreatePeriods}
        onChange={(autoCreatePeriods) =>
          setDraft({ ...draft, autoCreatePeriods })
        }
      />
    </>
  );
}

// How late a submission is still accepted: the deadline itself, the always-on
// grace window, and what happens after it.
function SubmissionWindowFields({ draft, setDraft }: FieldGroupProps) {
  return (
    <>
      <NumberField
        id="deadline-days"
        label="Default deadline days"
        bounds={fieldLimits.DEFAULT_DEADLINE_DAYS}
        value={draft.defaultDeadlineDays}
        onChange={(defaultDeadlineDays) =>
          setDraft({ ...draft, defaultDeadlineDays })
        }
        hint="Number of days after period start before reports are due."
      />

      <NumberField
        id="grace-period-hours"
        label="Grace period (hours)"
        bounds={fieldLimits.GRACE_PERIOD_HOURS}
        value={draft.gracePeriodHours}
        onChange={(gracePeriodHours) =>
          setDraft({ ...draft, gracePeriodHours })
        }
        hint="Submissions within this many hours past the deadline are always accepted, regardless of «allow late submissions». Must be 0..168 (one week)."
      />

      <ToggleField
        name="allow-late-submissions"
        title="Allow late submissions"
        description="Governs only what happens AFTER the grace window. When on, submissions are still accepted past the grace window. When off, submissions past deadline + grace are rejected."
        checked={draft.allowLateSubmissions}
        onChange={(allowLateSubmissions) =>
          setDraft({ ...draft, allowLateSubmissions })
        }
      />
    </>
  );
}

// What publishes automatically once the window closes, and when a published
// period drops out of the default views.
function PublicationFields({ draft, setDraft }: FieldGroupProps) {
  return (
    <>
      <ToggleField
        name="auto-publish-after-deadline"
        title="Auto-publish after deadline"
        description={
          <>
            When on, the hourly auto-publisher publishes any still-draft period
            once <code>deadline + grace</code> has passed (at the next top of
            the hour); sections leads never submitted appear empty in the
            published report. Independent of «Auto-create periods».
          </>
        }
        checked={draft.autoPublishAfterDeadline}
        onChange={(autoPublishAfterDeadline) =>
          setDraft({ ...draft, autoPublishAfterDeadline })
        }
      />

      <NumberField
        id="auto-archive-weeks"
        label="Auto-archive published periods after (weeks)"
        bounds={fieldLimits.AUTO_ARCHIVE_WEEKS}
        value={draft.autoArchiveWeeksAfterPublish}
        onChange={(autoArchiveWeeksAfterPublish) =>
          setDraft({ ...draft, autoArchiveWeeksAfterPublish })
        }
        hint="0 = never archive. Otherwise: a published period drops out of the default «active» views after N weeks."
      />
    </>
  );
}
