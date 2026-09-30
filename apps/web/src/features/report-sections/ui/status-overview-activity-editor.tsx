"use client";

import {
  MAX_ACTIVITY_NAME_LENGTH,
  SAFE_TEXT_MAX_LENGTH,
} from "@customreport/shared";
import { useEffect, useRef, useState } from "react";

import { useInlineEditUnloadGuard } from "./use-inline-edit-unload-guard";

export interface StatusOverviewActivityFieldsValue {
  readonly titleOverride: string | null;
  readonly description: string | null;
  readonly catalogueName: string;
}

export interface StatusOverviewActivityFieldsChange {
  readonly titleOverride: string | null;
  readonly description: string | null;
}

// Lengths are checked on the trimmed value, as the save schema trims it.
function limitError(
  label: string,
  value: string,
  limit: number,
): string | undefined {
  return value.trim().length > limit
    ? `${label} must be ${String(limit)} characters or fewer.`
    : undefined;
}

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | undefined;
}) {
  return message === undefined ? null : (
    <span
      id={id}
      role="alert"
      className="mt-1 block text-xs font-normal text-[var(--color-destructive)]"
    >
      {message}
    </span>
  );
}

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
  const [title, setTitle] = useState(values.titleOverride ?? "");
  const [description, setDescription] = useState(values.description ?? "");
  const [dirty, setDirty] = useState(false);
  const authoritativeValues = useRef({
    titleOverride: values.titleOverride,
    description: values.description,
  });
  useInlineEditUnloadGuard(dirty);
  useEffect(() => {
    const changed =
      authoritativeValues.current.titleOverride !== values.titleOverride ||
      authoritativeValues.current.description !== values.description;
    authoritativeValues.current = {
      titleOverride: values.titleOverride,
      description: values.description,
    };
    if (!dirty && changed) {
      setTitle(values.titleOverride ?? "");
      setDescription(values.description ?? "");
    }
  }, [dirty, values.description, values.titleOverride]);
  useEffect(
    () => () => onPendingChange?.(activityId, false),
    [activityId, onPendingChange],
  );

  const setDraftDirty = (next: boolean): void => {
    setDirty(next);
    onPendingChange?.(activityId, next);
  };

  const normalize = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const titleError = limitError(
    "Weekly title",
    title,
    MAX_ACTIVITY_NAME_LENGTH,
  );
  const descriptionError = limitError(
    "Description",
    description,
    SAFE_TEXT_MAX_LENGTH,
  );
  const invalid = titleError !== undefined || descriptionError !== undefined;

  const save = (): void => {
    if (invalid) return;
    onChange(activityId, {
      titleOverride: normalize(title),
      description: normalize(description),
    });
    setDraftDirty(false);
  };

  const reset = (): void => {
    setTitle("");
    setDraftDirty(true);
  };

  const cancel = (): void => {
    setTitle(values.titleOverride ?? "");
    setDescription(values.description ?? "");
    setDraftDirty(false);
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
        <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
          Weekly title
          <input
            type="text"
            name={`activity-title-${activityId}`}
            autoComplete="off"
            value={title}
            placeholder={values.catalogueName}
            onChange={(event) => {
              setTitle(event.target.value);
              setDraftDirty(true);
            }}
            aria-invalid={titleError !== undefined}
            aria-describedby={
              titleError === undefined
                ? undefined
                : `activity-title-error-${activityId}`
            }
            data-testid={`activity-title-${activityId}`}
            className="mt-1 block min-h-[var(--touch-target-min)] w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
          <FieldError
            id={`activity-title-error-${activityId}`}
            message={titleError}
          />
        </label>
        <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
          Description
          <textarea
            name={`activity-description-${activityId}`}
            autoComplete="off"
            value={description}
            rows={2}
            onChange={(event) => {
              setDescription(event.target.value);
              setDraftDirty(true);
            }}
            aria-invalid={descriptionError !== undefined}
            aria-describedby={
              descriptionError === undefined
                ? undefined
                : `activity-description-error-${activityId}`
            }
            data-testid={`activity-description-${activityId}`}
            className="mt-1 block min-h-[var(--touch-target-min)] w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
          <FieldError
            id={`activity-description-error-${activityId}`}
            message={descriptionError}
          />
        </label>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button
          type="submit"
          disabled={!dirty || invalid}
          data-testid={`activity-fields-save-${activityId}`}
          className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
        >
          Save weekly fields
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={!dirty}
          data-testid={`activity-fields-cancel-${activityId}`}
          className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={reset}
          data-testid={`activity-fields-reset-${activityId}`}
          className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          Reset to catalogue name
        </button>
      </div>
    </form>
  );
}
