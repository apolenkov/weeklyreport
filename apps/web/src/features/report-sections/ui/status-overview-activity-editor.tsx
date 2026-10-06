"use client";

import { useEffect, useRef } from "react";

import {
  ActivityDescriptionField,
  ActivityFieldActions,
  activityFieldErrors,
  ActivityTitleField,
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
  onClose,
}: {
  readonly activityId: string;
  readonly values: StatusOverviewActivityFieldsValue;
  readonly onChange: (
    activityId: string,
    next: StatusOverviewActivityFieldsChange,
  ) => void;
  readonly onPendingChange?:
    ((activityId: string, pending: boolean) => void) | undefined;
  /** Called after Save or Cancel so the parent can close the form. */
  readonly onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => formRef.current?.focus(), []);
  const draft = useActivityFieldsDraft(activityId, values, onPendingChange);
  const { titleError, descriptionError, invalid } = activityFieldErrors(
    draft.title,
    draft.description,
  );

  const save = (): void => {
    if (invalid) return;
    onChange(activityId, {
      titleOverride: normalize(draft.title),
      description: normalize(draft.description),
    });
    draft.markClean();
    onClose();
  };

  return (
    <form
      ref={formRef}
      tabIndex={-1}
      className="min-w-0 border-t border-[var(--color-border-subtle)] focus:outline-none bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-4 py-3"
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
        onCancel={() => {
          draft.cancel();
          onClose();
        }}
        onReset={draft.reset}
      />
    </form>
  );
}
