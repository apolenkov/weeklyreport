"use client";

import type { PeriodListItem } from "@customreport/shared";
import type { RefObject } from "react";
import { useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { toIsoDateString } from "../../../shared/lib/format/format-date";
import {
  PeriodDialogActions,
  PeriodDialogSurface,
} from "./periods-tab-dialog-chrome";
import { CreatePeriodFields } from "./periods-tab-dialog-fields";
import {
  computeDeadlineError,
  dateTimeInputValue,
  nextMonday,
} from "./periods-tab-dialog-helpers";

// `deadline` and `weekLabel` are nullable so edit-mode can clear an existing
// value with an explicit `null` — a period without a deadline is legal and
// deadline-driven automation skips it. Create-mode omits them instead.
export interface CreatePeriodValues {
  periodStart: Date;
  periodEnd?: Date | undefined;
  deadline?: Date | null | undefined;
  weekLabel?: string | null | undefined;
}

const DEADLINE_CLEARED_HINT =
  "No deadline: reminders and auto-publish will not run for this period.";
const PERIOD_END_REQUIRED_ERROR = "End date is required when editing a period.";

const DIALOG_COPY = {
  create: {
    title: "New period",
    description:
      "Mints a reporting period without waiting for the daily auto-creator. Any start date is allowed; end date and deadline default from AppSettings when left blank.",
    submit: { idle: "Create", pending: "Creating…" },
  },
  edit: {
    title: "Edit period",
    description: "Adjust the date envelope or label for this reporting period.",
    submit: { idle: "Save", pending: "Saving…" },
  },
} as const;

interface PeriodFieldValues {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  readonly weekLabel: string;
}

interface PeriodFieldSetters {
  readonly setPeriodStart: (next: string) => void;
  readonly setPeriodEnd: (next: string) => void;
  readonly setDeadline: (next: string) => void;
  readonly setWeekLabel: (next: string) => void;
}

// Initialise from the edited row when there is one, from the scheduler default
// otherwise. The lazy-init form (`useState(() => …)`) keeps both branches cheap.
function usePeriodDialogForm(
  editedPeriod: PeriodListItem | undefined,
  onCancel: () => void,
): {
  readonly values: PeriodFieldValues;
  readonly setters: PeriodFieldSetters;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
} {
  const [periodStart, setPeriodStart] = useState(() =>
    editedPeriod
      ? toIsoDateString(editedPeriod.periodStart)
      : nextMonday(new Date()),
  );
  const [periodEnd, setPeriodEnd] = useState(() =>
    editedPeriod ? toIsoDateString(editedPeriod.periodEnd) : "",
  );
  const [deadline, setDeadline] = useState(() =>
    editedPeriod && editedPeriod.deadline !== null
      ? dateTimeInputValue(editedPeriod.deadline)
      : "",
  );
  const [weekLabel, setWeekLabel] = useState(editedPeriod?.weekLabel ?? "");
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close via the shared primitive. The dialog mounts on
  // open and `autoFocus`es the first field; the primitive captures the opener at
  // render, so it still restores focus to the trigger on close.
  useDialogFocus({ open: true, onClose: onCancel, containerRef: surfaceRef });

  return {
    values: { periodStart, periodEnd, deadline, weekLabel },
    setters: { setPeriodStart, setPeriodEnd, setDeadline, setWeekLabel },
    surfaceRef,
  };
}

// Empty means "clear this value" while editing and "let the server derive the
// default" while creating.
function resolveDeadlineForSubmit(
  deadline: string,
  isEdit: boolean,
): Date | null | undefined {
  if (deadline !== "") return new Date(`${deadline}:00.000Z`);
  return isEdit ? null : undefined;
}

function resolveWeekLabelForSubmit(
  weekLabel: string,
  isEdit: boolean,
): string | null | undefined {
  const trimmed = weekLabel.trim();
  if (trimmed !== "") return trimmed;
  return isEdit ? null : undefined;
}

function buildCreatePeriodValues(
  values: PeriodFieldValues,
  isEdit: boolean,
): CreatePeriodValues {
  return {
    periodStart: new Date(`${values.periodStart}T00:00:00.000Z`),
    periodEnd: values.periodEnd
      ? new Date(`${values.periodEnd}T23:59:59.999Z`)
      : undefined,
    deadline: resolveDeadlineForSubmit(values.deadline, isEdit),
    weekLabel: resolveWeekLabelForSubmit(values.weekLabel, isEdit),
  };
}

// An empty deadline in edit-mode is a legal explicit clear, so it earns a
// consequence hint rather than an error. An end date cannot be cleared — a
// period must end — so emptying it in edit-mode is a loud error.
function derivePeriodDialogValidation(
  values: PeriodFieldValues,
  isEdit: boolean,
  isPending: boolean,
): {
  readonly deadlineError: string | null;
  readonly deadlineClearHint: string | null;
  readonly periodEndError: string | null;
  readonly canSubmit: boolean;
} {
  const deadlineError = computeDeadlineError({
    deadline: values.deadline,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
  });
  const periodEndError =
    isEdit && values.periodEnd === "" ? PERIOD_END_REQUIRED_ERROR : null;

  return {
    deadlineError,
    deadlineClearHint:
      isEdit && values.deadline === "" ? DEADLINE_CLEARED_HINT : null,
    periodEndError,
    canSubmit:
      values.periodStart !== "" &&
      !isPending &&
      !deadlineError &&
      !periodEndError,
  };
}

interface CreatePeriodDialogProps {
  // `create` opens as «New period» with a scheduler-aligned default; `edit`
  // opens as «Edit period» prefilled from `initialValues` (the row being edited).
  readonly mode: "create" | "edit";
  readonly initialValues?: PeriodListItem;
  readonly onCancel: () => void;
  readonly onSubmit: (values: CreatePeriodValues) => void;
  readonly isPending: boolean;
}

export function CreatePeriodDialog({
  mode,
  initialValues,
  onCancel,
  onSubmit,
  isPending,
}: CreatePeriodDialogProps) {
  // Edit semantics need the row itself; without it the dialog stays in create mode.
  const editedPeriod = mode === "edit" ? initialValues : undefined;
  const isEdit = editedPeriod !== undefined;
  // While the mutation is in flight the dialog must stay put: Escape, backdrop
  // click, and the Cancel button are all suppressed so a submit can't be
  // abandoned mid-flight.
  const guardedCancel = isPending ? () => undefined : onCancel;
  const { values, setters, surfaceRef } = usePeriodDialogForm(
    editedPeriod,
    guardedCancel,
  );
  const validation = derivePeriodDialogValidation(values, isEdit, isPending);
  const copy = DIALOG_COPY[isEdit ? "edit" : "create"];

  function handleSubmit() {
    if (values.periodStart === "") return;
    onSubmit(buildCreatePeriodValues(values, isEdit));
  }

  return (
    <PeriodDialogSurface
      mode={mode}
      title={copy.title}
      description={copy.description}
      onCancel={guardedCancel}
      surfaceRef={surfaceRef}
    >
      <CreatePeriodFields
        periodStart={values.periodStart}
        onPeriodStartChange={setters.setPeriodStart}
        periodEnd={values.periodEnd}
        onPeriodEndChange={setters.setPeriodEnd}
        periodEndError={validation.periodEndError}
        deadline={values.deadline}
        onDeadlineChange={setters.setDeadline}
        deadlineError={validation.deadlineError}
        deadlineClearHint={validation.deadlineClearHint}
        weekLabel={values.weekLabel}
        onWeekLabelChange={setters.setWeekLabel}
      />
      <PeriodDialogActions
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isPending={isPending}
        canSubmit={validation.canSubmit}
        submitLabel={copy.submit[isPending ? "pending" : "idle"]}
      />
    </PeriodDialogSurface>
  );
}
