"use client";

type StageMultiSelectProps = {
  readonly id: string;
  readonly value: string[];
  readonly stages: readonly string[];
  readonly error?: string;
  readonly onChange: (next: string[]) => void;
};

export function StageMultiSelect({
  id,
  value,
  stages,
  error,
  onChange,
}: StageMultiSelectProps) {
  const selected = value;
  const helperId = `${id}-hint`;
  const errorId = `${id}-error`;

  function toggle(stage: string) {
    const next = selected.includes(stage)
      ? selected.filter((item) => item !== stage)
      : [...selected, stage];
    onChange(next);
  }

  const singleStage = stages.length === 1 ? stages[0] : undefined;

  return (
    <fieldset
      aria-describedby={error ? `${helperId} ${errorId}` : helperId}
      aria-invalid={error ? "true" : "false"}
    >
      <legend className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        SDLC Stages
      </legend>
      <p
        id={helperId}
        className="mb-2 text-[11px] text-[var(--color-muted-foreground)]"
      >
        Optional. Leave empty to apply to all assigned stages.
      </p>
      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.18)] bg-[var(--color-muted)] px-3 py-2.5 text-sm text-[var(--color-muted-foreground)]">
          No assigned stages available.
        </div>
      ) : singleStage ? (
        <div className="inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
          {singleStage}
          <span className="ml-2 text-[10px] font-medium">
            Applied automatically
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {stages.map((stage) => {
            const checked = selected.includes(stage);
            return (
              <label
                key={stage}
                className={
                  "inline-flex min-h-[34px] items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors " +
                  (checked
                    ? "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]"
                    : "border-[rgba(0,0,0,0.18)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)]")
                }
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--color-starbucks-accent)]"
                  checked={checked}
                  onChange={() => toggle(stage)}
                />
                {stage}
              </label>
            );
          })}
        </div>
      )}
      {selected.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
          Scope: all assigned stages.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
          <span>Scope:</span>
          {selected.map((stage) => (
            <span
              key={stage}
              className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]"
            >
              {stage}
            </span>
          ))}
        </div>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
