"use client";

import { MAX_WEEK_LABEL_LENGTH } from "@customreport/shared";
import type { ReactNode } from "react";

interface CreatePeriodFieldsProps {
  readonly periodStart: string;
  readonly onPeriodStartChange: (value: string) => void;
  readonly periodEnd: string;
  readonly onPeriodEndChange: (value: string) => void;
  readonly isEdit: boolean;
  readonly periodEndError: string | null;
  readonly deadline: string;
  readonly onDeadlineChange: (value: string) => void;
  readonly deadlineError: string | null;
  readonly deadlineClearHint: string | null;
  readonly weekLabel: string;
  readonly onWeekLabelChange: (value: string) => void;
}

const FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const INVALID_FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] focus:border-[var(--color-destructive)]";

function OptionalHint() {
  return (
    <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
      (optional)
    </span>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  readonly htmlFor: string;
  readonly children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
    >
      {children}
    </label>
  );
}

function FieldError({
  id,
  testId,
  message,
}: {
  readonly id: string;
  readonly testId: string;
  readonly message: string;
}) {
  return (
    <p
      id={id}
      data-testid={testId}
      className="mt-1 text-xs text-[var(--color-destructive)]"
    >
      {message}
    </p>
  );
}

function PeriodStartField({
  periodStart,
  onPeriodStartChange,
}: Pick<CreatePeriodFieldsProps, "periodStart" | "onPeriodStartChange">) {
  return (
    <div>
      <FieldLabel htmlFor="period-start">
        Period start
        <span className="text-[var(--color-destructive-emphasis)]">*</span>
      </FieldLabel>
      <input
        id="period-start"
        type="date"
        value={periodStart}
        onChange={(e) => onPeriodStartChange(e.target.value)}
        required
        data-testid="periods-create-start"
        className={FIELD_CLASS}
      />
    </div>
  );
}

function PeriodEndField({
  periodEnd,
  onPeriodEndChange,
  isEdit,
  periodEndError,
}: Pick<
  CreatePeriodFieldsProps,
  "periodEnd" | "onPeriodEndChange" | "isEdit" | "periodEndError"
>) {
  return (
    <div>
      <FieldLabel htmlFor="period-end">
        Period end
        {isEdit ? (
          <span className="text-[var(--color-destructive-emphasis)]">*</span>
        ) : (
          <OptionalHint />
        )}
      </FieldLabel>
      <input
        id="period-end"
        type="date"
        value={periodEnd}
        onChange={(e) => onPeriodEndChange(e.target.value)}
        required={isEdit}
        aria-required={isEdit}
        aria-invalid={periodEndError !== null}
        aria-describedby={periodEndError ? "period-end-error" : undefined}
        data-testid="periods-create-end"
        className={periodEndError ? INVALID_FIELD_CLASS : FIELD_CLASS}
      />
      {periodEndError && (
        <FieldError
          id="period-end-error"
          testId="periods-end-error"
          message={periodEndError}
        />
      )}
    </div>
  );
}

function DeadlineField({
  deadline,
  onDeadlineChange,
  deadlineError,
  deadlineClearHint,
}: Pick<
  CreatePeriodFieldsProps,
  "deadline" | "onDeadlineChange" | "deadlineError" | "deadlineClearHint"
>) {
  return (
    <div>
      <FieldLabel htmlFor="period-deadline">
        Deadline <OptionalHint />
      </FieldLabel>
      <input
        id="period-deadline"
        type="datetime-local"
        value={deadline}
        onChange={(e) => onDeadlineChange(e.target.value)}
        aria-invalid={deadlineError !== null}
        aria-describedby={deadlineError ? "period-deadline-error" : undefined}
        data-testid="periods-create-deadline"
        className={deadlineError ? INVALID_FIELD_CLASS : FIELD_CLASS}
      />
      {deadlineError && (
        <FieldError
          id="period-deadline-error"
          testId="periods-deadline-error"
          message={deadlineError}
        />
      )}
      {!deadlineError && deadlineClearHint && (
        <p
          id="period-deadline-hint"
          data-testid="periods-deadline-hint"
          className="mt-1 text-xs text-[var(--color-muted-foreground)]"
        >
          {deadlineClearHint}
        </p>
      )}
    </div>
  );
}

function WeekLabelField({
  weekLabel,
  onWeekLabelChange,
}: Pick<CreatePeriodFieldsProps, "weekLabel" | "onWeekLabelChange">) {
  return (
    <div>
      <FieldLabel htmlFor="period-label">
        Period label <OptionalHint />
      </FieldLabel>
      <input
        id="period-label"
        type="text"
        value={weekLabel}
        onChange={(e) => onWeekLabelChange(e.target.value)}
        maxLength={MAX_WEEK_LABEL_LENGTH}
        placeholder="e.g. Sprint 12 catch-up"
        data-testid="periods-create-label"
        className={FIELD_CLASS}
      />
    </div>
  );
}

export function CreatePeriodFields(props: CreatePeriodFieldsProps) {
  return (
    <div className="mt-4 space-y-4">
      <PeriodStartField {...props} />
      <PeriodEndField {...props} />
      <DeadlineField {...props} />
      <WeekLabelField {...props} />
    </div>
  );
}
