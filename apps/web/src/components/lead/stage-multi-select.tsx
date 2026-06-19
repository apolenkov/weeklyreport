"use client";

import { canonicalStageName } from "./stage-tags";

interface StageMultiSelectProps {
  readonly id: string;
  readonly value: string[];
  readonly stages: readonly string[];
  readonly error?: string;
  readonly onChange: (next: string[]) => void;
  /** When provided, shows a consequence-preview banner above the stage chips. */
  readonly previewSeverity?: "at-risk" | "blocked";
  /**
   * When true, the host dialog requires at least one stage, so the helper copy
   * drops the "optional / empty = all assigned stages" wording and the
   * empty-selection "all stages" hint. A single owned stage still
   * auto-applies, and saving with no stage is blocked by the host dialog.
   */
  readonly required?: boolean;
}

export function StageMultiSelect({
  id,
  value,
  stages,
  error,
  onChange,
  previewSeverity,
  required = false,
}: StageMultiSelectProps) {
  const selected = value;
  const helperId = `${id}-hint`;
  const errorId = `${id}-error`;

  // stage-label-canonicalization: match the option against the stored value by
  // canonical name, so a legacy "Dev"-stored selection still reads as checked
  // when the option is the canonical "Development" (and toggling-off removes it).
  function isSelected(stage: string): boolean {
    const canonical = canonicalStageName(stage);
    return selected.some((item) => canonicalStageName(item) === canonical);
  }

  function toggle(stage: string) {
    const canonical = canonicalStageName(stage);
    const next = isSelected(stage)
      ? selected.filter((item) => canonicalStageName(item) !== canonical)
      : [...selected, stage];
    onChange(next);
  }

  const singleStage = stages.length === 1 ? stages[0] : undefined;
  const isMultiChoice = stages.length >= 2;
  const severityLabel = previewSeverity === "blocked" ? "Blocked" : "At Risk";

  // Banner copy: collapse to a generic line when more than one stage is
  // selected; name the stage when exactly one is selected; default copy when
  // nothing is selected.
  let bannerText = "";
  if (isMultiChoice && previewSeverity) {
    if (selected.length === 0) {
      bannerText = `All assigned stages will show as ${severityLabel}.`;
    } else if (selected.length === 1) {
      bannerText = `Stage ${selected[0]} will show as ${severityLabel}.`;
    } else {
      bannerText = `Selected stages will show as ${severityLabel}.`;
    }
  }

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
        {required
          ? "Required. Select at least one assigned stage — a single owned stage is applied automatically."
          : "Optional. Leave empty to apply to all assigned stages. Tip: mark the stage as blocked on the SDLC pipeline above before pinning a risk — that keeps your blocker scope honest."}
      </p>
      {bannerText && (
        <div
          data-testid="stage-scope-banner"
          role="status"
          aria-live="polite"
          className="mb-2 flex w-full items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <AlertTriangleIcon />
          <span>{bannerText}</span>
        </div>
      )}
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
        <div
          data-testid="stage-checkbox-group"
          className="flex flex-wrap gap-2"
        >
          {stages.map((stage) => {
            const checked = isSelected(stage);
            return (
              <label
                key={stage}
                className={`inline-flex min-h-[34px] items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors ${
                  checked
                    ? "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]"
                    : "border-[rgba(0,0,0,0.18)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)]"
                }`}
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
      {!required &&
        !previewSeverity &&
        selected.length === 0 &&
        isMultiChoice && (
          <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
            Scope: all assigned stages.
          </p>
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

function AlertTriangleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
