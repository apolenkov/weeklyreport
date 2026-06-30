"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useEffect, useState } from "react";

/**
 * Compute the scheduler-aligned default start date. Manual periods are not
 * restricted to Mondays; this only keeps the untouched create dialog aligned
 * with the automatic weekly cadence.
 */
function nextMonday(from: Date): string {
  const d = new Date(from);
  // getUTCDay: 0=Sun, 1=Mon..6=Sat. For Sun add 1 day; for any other
  // weekday add (8 - day) % 7 days. For Monday this evaluates to 0 →
  // returns `from` unchanged.
  const day = d.getUTCDay();
  const offset = day === 0 ? 1 : (8 - day) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  // Render as `YYYY-MM-DD` for the <input type="date"> value.
  return d.toISOString().slice(0, 10);
}

export interface CreatePeriodValues {
  periodStart: Date;
  // UFB-067: nullable in edit-mode so the dialog can clear an existing
  // weekLabel via explicit `null`. Create-mode submitters never pass
  // `null` here (empty input → undefined / omit).
  periodEnd?: Date;
  deadline?: Date;
  weekLabel?: string | null;
}

/**
 * UFB-067: render a UTC Date as the `YYYY-MM-DD` value that
 * `<input type="date">` expects. Used both by the next-Monday default
 * and by the edit-mode prefill of an existing row's envelope. The slice
 * matches the existing create-path `${periodStart}T00:00:00.000Z` round-trip
 * so a no-op edit round-trips without spurious diff.
 */
function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Render a UTC Date as the `YYYY-MM-DDTHH:MM` value that
 * `<input type="datetime-local">` expects. The field is UTC wall-clock on
 * both read and write: this slice produces the UTC wall-clock string, and
 * handleSubmit parses it back with an explicit `:00.000Z` suffix. Treating
 * the value as UTC on both sides keeps the round-trip stable in every
 * timezone — a bare `new Date(value)` parse would read it as local time and
 * drift the stored deadline for any non-UTC admin.
 */
function dateTimeInputValue(d: Date): string {
  return d.toISOString().slice(0, 16);
}

export function CreatePeriodDialog({
  mode,
  initialValues,
  onCancel,
  onSubmit,
  isPending,
}: {
  /**
   * UFB-067: `mode === 'create'` opens the dialog as «New period» with
   * a scheduler-aligned default; `mode === 'edit'` opens it as «Edit period»
   * prefilled from `initialValues` (the row being edited).
   */
  readonly mode: "create" | "edit";
  readonly initialValues?: PeriodListItem;
  readonly onCancel: () => void;
  readonly onSubmit: (values: CreatePeriodValues) => void;
  readonly isPending: boolean;
}) {
  const isEdit = mode === "edit" && initialValues !== undefined;

  // Initialise from the row in edit-mode; from the scheduler default otherwise.
  // The lazy-init form (`useState(() => …)`) keeps both branches cheap.
  const [periodStart, setPeriodStart] = useState(() =>
    isEdit ? dateInputValue(initialValues.periodStart) : nextMonday(new Date()),
  );
  const [periodEnd, setPeriodEnd] = useState(() =>
    isEdit ? dateInputValue(initialValues.periodEnd) : "",
  );
  const [deadline, setDeadline] = useState(() =>
    isEdit ? dateTimeInputValue(initialValues.deadline) : "",
  );
  const [weekLabel, setWeekLabel] = useState(
    isEdit ? (initialValues.weekLabel ?? "") : "",
  );

  // Esc-to-close + click-outside (matches the groups-tab dialog pattern).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function handleSubmit() {
    if (!periodStart) return;
    const startDate = new Date(`${periodStart}T00:00:00.000Z`);
    const endDate = periodEnd
      ? new Date(`${periodEnd}T23:59:59.999Z`)
      : undefined;
    const deadlineDate = deadline ? new Date(`${deadline}:00.000Z`) : undefined;

    // UFB-067: weekLabel clear semantics differ by mode.
    // - create: empty → `undefined` (omit from payload).
    // - edit:   empty → `null` (explicit clear of an existing label).
    let weekLabelValue: string | null | undefined;
    const trimmed = weekLabel.trim();
    if (trimmed === "") {
      weekLabelValue = isEdit ? null : undefined;
    } else {
      weekLabelValue = trimmed;
    }

    onSubmit({
      periodStart: startDate,
      periodEnd: endDate,
      deadline: deadlineDate,
      weekLabel: weekLabelValue,
    });
  }

  // A6b: deadline range validation.
  // Deadline must fall within [periodStart, periodEnd] when both are set.
  const deadlineError: string | null = (() => {
    if (!deadline) return null;
    // Parse the datetime-local value as UTC wall-clock to match the submit
    // parse and the UTC-parsed start/end bounds below.
    const dl = new Date(`${deadline}:00.000Z`);
    if (periodStart) {
      const start = new Date(`${periodStart}T00:00:00.000Z`);
      if (dl < start) return "Deadline cannot be before period start.";
    }
    if (periodEnd) {
      const end = new Date(`${periodEnd}T23:59:59.999Z`);
      if (dl > end) return "Deadline cannot be after period end.";
    }
    return null;
  })();

  const canSubmit = periodStart !== "" && !isPending && !deadlineError;
  const title = isEdit ? "Edit period" : "New period";
  const description = isEdit
    ? "Adjust the date envelope or label for this reporting period."
    : "Mints a reporting period without waiting for the daily auto-creator. Any start date is allowed; end date and deadline default from AppSettings when left blank.";
  const submitCopy = isEdit
    ? isPending
      ? "Saving…"
      : "Save"
    : isPending
      ? "Creating…"
      : "Create";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
      data-testid="periods-create-dialog"
      data-dialog-mode={mode}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to the backdrop; not a user interaction, no keyboard equivalent applies */}
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="period-start"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period start <span className="text-[#991b1b]">*</span>
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
              autoFocus
              data-testid="periods-create-start"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-end"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period end{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-testid="periods-create-end"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-deadline"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Deadline{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="periods-create-deadline"
              className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ${deadlineError ? "border-red-400 focus:border-red-400 bg-red-50" : "border-[var(--color-border)] focus:border-[var(--color-starbucks-accent)] bg-white"}`}
            />
            {deadlineError && (
              <p
                data-testid="periods-deadline-error"
                className="mt-1 text-xs text-red-600"
              >
                {deadlineError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="period-label"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period label{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-label"
              type="text"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              maxLength={64}
              placeholder="e.g. Sprint 12 catch-up"
              data-testid="periods-create-label"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            data-testid="periods-create-cancel"
            className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="periods-create-submit"
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitCopy}
          </button>
        </div>
      </div>
    </div>
  );
}
