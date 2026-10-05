"use client";

import {
  MAX_ACTIVITY_NAME_LENGTH,
  SAFE_TEXT_MAX_LENGTH,
} from "@customreport/shared";

import {
  ActivityDescriptionField,
  ActivityFieldActions,
  ActivityTitleField,
  limitError,
  normalize,
  type StatusOverviewActivityFieldsChange,
  type StatusOverviewActivityFieldsValue,
  useActivityFieldsDraft,
} from "./status-overview-activity-fields";

export type {
  StatusOverviewActivityFieldsChange,
  StatusOverviewActivityFieldsValue,
} from "./status-overview-activity-fields";

// Weekly title/description editor for one activity unit in the Overview row
// composer. Keeps local input while a save is pending and never renames the
// catalogue entry: blank resets the field to null (catalogue fallback).
export function StatusOverviewActivityEditor({
  activityId,
  values,
  onChange,
  onPendingChange,
}: {
  readonly activityId: string;
  readonly values: StatusOverviewActivityFieldsValue;
  readonly onChange: (
    activityId: string,
    next: StatusOverviewActivityFieldsChange,
  ) => void;
  readonly onPendingChange?:
    ((activityId: string, pending: boolean) => void) | undefined;
}) {
  const draft = useActivityFieldsDraft(activityId, values, onPendingChange);
  const titleError = limitError(
    "Weekly title",
    draft.title,
    MAX_ACTIVITY_NAME_LENGTH,
  );
  const descriptionError = limitError(
    "Description",
    draft.description,
    SAFE_TEXT_MAX_LENGTH,
  );
  const invalid = titleError !== undefined || descriptionError !== undefined;

  const save = (): void => {
    if (invalid) return;
    onChange(activityId, {
      titleOverride: normalize(draft.title),
      description: normalize(draft.description),
    });
    draft.markClean();
  };

  return (
    <form
      className="min-w-0 border-t border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-4 py-3"
      aria-label={`Weekly fields for ${values.catalogueName}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        Weekly fields
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <ActivityTitleField
          activityId={activityId}
          value={draft.title}
          placeholder={values.catalogueName}
          error={titleError}
          onChange={draft.editTitle}
        />
        <ActivityDescriptionField
          activityId={activityId}
          value={draft.description}
          error={descriptionError}
          onChange={draft.editDescription}
        />
      </div>
      <ActivityFieldActions
        activityId={activityId}
        dirty={draft.dirty}
        invalid={invalid}
        onCancel={draft.cancel}
        onReset={draft.reset}
      />
    </form>
  );
}
