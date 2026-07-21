"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { CreatePeriodFields } from "./periods-tab-dialog-fields";
import {
  computeDeadlineError,
  dateInputValue,
  dateTimeInputValue,
  nextMonday,
} from "./periods-tab-dialog-helpers";

export interface CreatePeriodValues {
  periodStart: Date;
  // nullable in edit-mode so the dialog can clear an existing weekLabel via
  // explicit `null`. Create-mode submitters never pass `null` here (empty
  // input → undefined / omit).
  periodEnd?: Date;
  deadline?: Date;
  weekLabel?: string | null;
}

export function CreatePeriodDialog({
  mode,
  initialValues,
  onCancel,
  onSubmit,
  isPending,
}: {
  /**
   * `mode === 'create'` opens the dialog as «New period» with
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
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close via the shared primitive. The dialog mounts on
  // open and `autoFocus`es the first field; the primitive captures the opener
  // at render, so it still restores focus to the trigger on close.
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });

  function handleSubmit() {
    if (!periodStart) return;
    const startDate = new Date(`${periodStart}T00:00:00.000Z`);
    const endDate = periodEnd
      ? new Date(`${periodEnd}T23:59:59.999Z`)
      : undefined;
    const deadlineDate = deadline ? new Date(`${deadline}:00.000Z`) : undefined;

    // weekLabel clear semantics differ by mode.
    // - create: empty → `undefined` (omit from payload).
    // - edit:   empty → `null` (explicit clear of an existing label).
    const trimmed = weekLabel.trim();
    const weekLabelValue =
      trimmed === "" ? (isEdit ? null : undefined) : trimmed;

    onSubmit({
      periodStart: startDate,
      periodEnd: endDate,
      deadline: deadlineDate,
      weekLabel: weekLabelValue,
    });
  }

  const deadlineError = computeDeadlineError({
    deadline,
    periodStart,
    periodEnd,
  });

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
        ref={dialogSurfaceRef}
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
        <CreatePeriodFields
          periodStart={periodStart}
          onPeriodStartChange={setPeriodStart}
          periodEnd={periodEnd}
          onPeriodEndChange={setPeriodEnd}
          deadline={deadline}
          onDeadlineChange={setDeadline}
          deadlineError={deadlineError}
          weekLabel={weekLabel}
          onWeekLabelChange={setWeekLabel}
        />
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
