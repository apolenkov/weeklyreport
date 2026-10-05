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
export function limitError(
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

export function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function useActivityFieldsDraft(
  activityId: string,
  values: StatusOverviewActivityFieldsValue,
  onPendingChange: ((activityId: string, pending: boolean) => void) | undefined,
) {
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

  const reset = (): void => {
    setTitle("");
    setDraftDirty(true);
  };

  const cancel = (): void => {
    setTitle(values.titleOverride ?? "");
    setDescription(values.description ?? "");
    setDraftDirty(false);
  };

  return {
    title,
    description,
    dirty,
    editTitle: (next: string) => {
      setTitle(next);
      setDraftDirty(true);
    },
    editDescription: (next: string) => {
      setDescription(next);
      setDraftDirty(true);
    },
    markClean: () => setDraftDirty(false),
    reset,
    cancel,
  };
}

export function ActivityTitleField({
  activityId,
  value,
  placeholder,
  error,
  onChange,
}: {
  readonly activityId: string;
  readonly value: string;
  readonly placeholder: string;
  readonly error: string | undefined;
  readonly onChange: (next: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
      Weekly title
      <input
        type="text"
        name={`activity-title-${activityId}`}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={error !== undefined}
        aria-describedby={
          error === undefined ? undefined : `activity-title-error-${activityId}`
        }
        data-testid={`activity-title-${activityId}`}
        className="mt-1 block min-h-[var(--touch-target-min)] w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      />
      <FieldError id={`activity-title-error-${activityId}`} message={error} />
    </label>
  );
}

export function ActivityDescriptionField({
  activityId,
  value,
  error,
  onChange,
}: {
  readonly activityId: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (next: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
      Description
      <textarea
        name={`activity-description-${activityId}`}
        autoComplete="off"
        value={value}
        rows={2}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={error !== undefined}
        aria-describedby={
          error === undefined
            ? undefined
            : `activity-description-error-${activityId}`
        }
        data-testid={`activity-description-${activityId}`}
        className="mt-1 block min-h-[var(--touch-target-min)] w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      />
      <FieldError
        id={`activity-description-error-${activityId}`}
        message={error}
      />
    </label>
  );
}

export function ActivityFieldActions({
  activityId,
  dirty,
  invalid,
  onCancel,
  onReset,
}: {
  readonly activityId: string;
  readonly dirty: boolean;
  readonly invalid: boolean;
  readonly onCancel: () => void;
  readonly onReset: () => void;
}) {
  return (
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
        onClick={onCancel}
        disabled={!dirty}
        data-testid={`activity-fields-cancel-${activityId}`}
        className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onReset}
        data-testid={`activity-fields-reset-${activityId}`}
        className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        Reset to catalogue name
      </button>
    </div>
  );
}
