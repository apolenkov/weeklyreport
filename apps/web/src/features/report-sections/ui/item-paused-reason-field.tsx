"use client";

/**
 * require-paused-item-reason: the reason field shown when Paused is the selected
 * status. Extracted so the dialog's conditional render stays flat (cognitive
 * complexity). Required — the parent blocks save while it is empty.
 */
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
        className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none ${
          error
            ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
            : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
        }`}
        style={{ minHeight: "52px" }}
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
