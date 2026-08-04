"use client";

// Two lines of text at the field's text-sm size without forcing a tall panel.
const PAUSED_REASON_MIN_HEIGHT_PX = 52;

// Parent blocks save while empty — reason is required for paused items.
export function PausedReasonField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor="item-paused-reason"
      >
        Pause reason *
      </label>
      <textarea
        id="item-paused-reason"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "item-paused-reason-error" : undefined}
        className={`w-full resize-y rounded-xl border bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none ${
          error
            ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[var(--shadow-focus-destructive)]"
            : "border-[var(--color-border-strong)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)]"
        }`}
        style={{ minHeight: `${PAUSED_REASON_MIN_HEIGHT_PX}px` }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Why is this paused? (e.g. waiting on a dependency)"
      />
      {error && (
        <p
          id="item-paused-reason-error"
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
