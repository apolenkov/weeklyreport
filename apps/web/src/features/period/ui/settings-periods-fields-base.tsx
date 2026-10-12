"use client";

import type { AppSettings } from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";

import {
  NumberField,
  ToggleField,
  WorkingDaysField,
} from "./settings-periods-field-controls";
import * as fieldLimits from "./settings-periods-fields-base-helpers";

interface FieldGroupProps {
  readonly draft: AppSettings;
  readonly setDraft: Dispatch<SetStateAction<AppSettings>>;
  readonly onValidityChange?: (id: string, valid: boolean) => void;
}

// Shell owns draft/Save; this component only renders the field group.
export function PeriodBaseFields({
  draft,
  setDraft,
  onValidityChange,
}: FieldGroupProps) {
  return (
    <>
      <PeriodShapeFields
        draft={draft}
        setDraft={setDraft}
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
      />
      <SubmissionWindowFields
        draft={draft}
        setDraft={setDraft}
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
      />
      <PublicationFields
        draft={draft}
        setDraft={setDraft}
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
      />
    </>
  );
}

// When a period starts, how long it runs, and whether the next one is created
// automatically.
function PeriodShapeFields({
  draft,
  setDraft,
  onValidityChange,
}: FieldGroupProps) {
  return (
    <>
      <NumberField
        id="period-length-days"
        label="Period length (days)"
        bounds={fieldLimits.PERIOD_LENGTH_DAYS}
        value={draft.periodLengthDays}
        onChange={(periodLengthDays) =>
          setDraft((current) => ({ ...current, periodLengthDays }))
        }
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
        hint="How many days each reporting period spans (default 7 = weekly)."
      />

      <WorkingDaysField
        value={draft.workingDays}
        onChange={(workingDays) =>
          setDraft((current) => ({ ...current, workingDays }))
        }
      />

      <ToggleField
        name="auto-create-periods"
        title="Auto-create periods"
        description="Create the next reporting period automatically when the schedule advances."
        checked={draft.autoCreatePeriods}
        onChange={(autoCreatePeriods) =>
          setDraft((current) => ({ ...current, autoCreatePeriods }))
        }
      />
    </>
  );
}

// How late a submission is still accepted: the deadline itself, the always-on
// grace window, and what happens after it.
function SubmissionWindowFields({
  draft,
  setDraft,
  onValidityChange,
}: FieldGroupProps) {
  return (
    <>
      <NumberField
        id="deadline-days"
        label="Default deadline days"
        bounds={fieldLimits.DEFAULT_DEADLINE_DAYS}
        value={draft.defaultDeadlineDays}
        onChange={(defaultDeadlineDays) =>
          setDraft((current) => ({ ...current, defaultDeadlineDays }))
        }
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
        hint="Number of days after period start before reports are due."
      />

      <NumberField
        id="grace-period-hours"
        label="Grace period (hours)"
        bounds={fieldLimits.GRACE_PERIOD_HOURS}
        value={draft.gracePeriodHours}
        onChange={(gracePeriodHours) =>
          setDraft((current) => ({ ...current, gracePeriodHours }))
        }
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
        hint={`Submissions within this many hours past the deadline are always accepted, regardless of «allow late submissions». Must be ${fieldLimits.GRACE_PERIOD_HOURS.min}..${fieldLimits.GRACE_PERIOD_HOURS.max} hours.`}
      />

      <ToggleField
        name="allow-late-submissions"
        title="Allow late submissions"
        description="Governs only what happens AFTER the grace window. When on, submissions are still accepted past the grace window. When off, submissions past deadline + grace are rejected."
        checked={draft.allowLateSubmissions}
        onChange={(allowLateSubmissions) =>
          setDraft((current) => ({ ...current, allowLateSubmissions }))
        }
      />
    </>
  );
}

// What publishes automatically once the window closes, and when a published
// period drops out of the default views.
function PublicationFields({
  draft,
  setDraft,
  onValidityChange,
}: FieldGroupProps) {
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
          setDraft((current) => ({ ...current, autoPublishAfterDeadline }))
        }
      />

      <NumberField
        id="auto-archive-weeks"
        label="Auto-archive published periods after (weeks)"
        bounds={fieldLimits.AUTO_ARCHIVE_WEEKS}
        value={draft.autoArchiveWeeksAfterPublish}
        onChange={(autoArchiveWeeksAfterPublish) =>
          setDraft((current) => ({ ...current, autoArchiveWeeksAfterPublish }))
        }
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
        hint="0 = never archive. Otherwise: a published period drops out of the default «active» views after N weeks."
      />
    </>
  );
}
