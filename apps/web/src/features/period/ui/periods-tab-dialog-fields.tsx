"use client";

interface CreatePeriodFieldsProps {
  readonly periodStart: string;
  readonly onPeriodStartChange: (value: string) => void;
  readonly periodEnd: string;
  readonly onPeriodEndChange: (value: string) => void;
  readonly deadline: string;
  readonly onDeadlineChange: (value: string) => void;
  readonly deadlineError: string | null;
  readonly deadlineRequired: boolean;
  readonly weekLabel: string;
  readonly onWeekLabelChange: (value: string) => void;
}

/**
 * The create/edit period dialog's four field blocks — start, end, deadline
 * (with inline validation), and label — split out so the dialog itself only
 * owns state and submit chrome.
 */
export function CreatePeriodFields({
  periodStart,
  onPeriodStartChange,
  periodEnd,
  onPeriodEndChange,
  deadline,
  onDeadlineChange,
  deadlineError,
  deadlineRequired,
  weekLabel,
  onWeekLabelChange,
}: CreatePeriodFieldsProps) {
  return (
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
          onChange={(e) => onPeriodStartChange(e.target.value)}
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
          onChange={(e) => onPeriodEndChange(e.target.value)}
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
          {deadlineRequired ? (
            <span className="text-[#991b1b]">*</span>
          ) : (
            <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
              (optional)
            </span>
          )}
        </label>
        <input
          id="period-deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => onDeadlineChange(e.target.value)}
          required={deadlineRequired}
          aria-invalid={deadlineError !== null}
          aria-describedby={deadlineError ? "period-deadline-error" : undefined}
          data-testid="periods-create-deadline"
          className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ${deadlineError ? "border-red-400 focus:border-red-400 bg-red-50" : "border-[var(--color-border)] focus:border-[var(--color-starbucks-accent)] bg-white"}`}
        />
        {deadlineError && (
          <p
            id="period-deadline-error"
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
          onChange={(e) => onWeekLabelChange(e.target.value)}
          maxLength={64}
          placeholder="e.g. Sprint 12 catch-up"
          data-testid="periods-create-label"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
      </div>
    </div>
  );
}
