"use client";

interface StageMultiSelectProps {
  readonly id: string;
  readonly value: readonly string[];
  readonly stages: readonly string[];
  readonly error?: string | undefined;
  readonly onChange: (next: string[]) => void;
  readonly previewSeverity?: "at-risk" | "blocked" | undefined;
  readonly required?: boolean | undefined;
}

function computeBannerText(
  selected: readonly string[],
  previewSeverity: "at-risk" | "blocked",
): string {
  const severityLabel = previewSeverity === "blocked" ? "Blocked" : "At Risk";
  const [onlySelected] = selected;
  if (onlySelected === undefined) {
    return "";
  }
  if (selected.length === 1) {
    return `Stage ${onlySelected} will show as ${severityLabel}.`;
  }
  return `Selected stages will show as ${severityLabel}.`;
}

function isStageSelected(selected: readonly string[], stage: string): boolean {
  return selected.includes(stage);
}

function toggleStage(selected: readonly string[], stage: string): string[] {
  return isStageSelected(selected, stage)
    ? selected.filter((item) => item !== stage)
    : [...selected, stage];
}

function deriveStageScopePresentation(
  selected: readonly string[],
  previewSeverity: "at-risk" | "blocked" | undefined,
) {
  return {
    bannerText: previewSeverity
      ? computeBannerText(selected, previewSeverity)
      : "",
  };
}

export function StageMultiSelect({
  id,
  value,
  stages,
  error,
  onChange,
  previewSeverity,
}: StageMultiSelectProps) {
  const selected = value;
  const helperId = `${id}-hint`;
  const errorId = `${id}-error`;

  const isSelected = (stage: string) => isStageSelected(selected, stage);
  const toggle = (stage: string) => onChange(toggleStage(selected, stage));

  const { bannerText } = deriveStageScopePresentation(
    selected,
    previewSeverity,
  );

  return (
    <fieldset
      aria-describedby={error ? `${helperId} ${errorId}` : helperId}
      aria-invalid={error ? "true" : "false"}
    >
      <legend className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        SDLC Stages
      </legend>
      <StageHelperText id={helperId} />
      {bannerText && <StageScopeBanner text={bannerText} />}
      <StageChoices stages={stages} isSelected={isSelected} onToggle={toggle} />
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

function StageHelperText({ id }: { readonly id: string }) {
  return (
    <p
      id={id}
      className="mb-2 text-[11px] text-[var(--color-muted-foreground)]"
    >
      Select at least one assigned stage. A single owned stage is applied
      automatically.
    </p>
  );
}

function StageScopeBanner({ text }: { readonly text: string }) {
  return (
    <div
      data-testid="stage-scope-banner"
      role="status"
      aria-live="polite"
      className="mb-2 flex w-full items-center gap-2 rounded-md border border-[var(--color-status-at-risk-border)] bg-[var(--color-status-at-risk-bg)] px-3 py-2 text-xs text-[var(--color-status-at-risk-fg)]"
    >
      <AlertTriangleIcon />
      <span>{text}</span>
    </div>
  );
}

// A lone assigned stage is applied automatically — shown as a static chip so
// the user cannot deselect the only valid scope.
function StageChoices({
  stages,
  isSelected,
  onToggle,
}: {
  readonly stages: readonly string[];
  readonly isSelected: (stage: string) => boolean;
  readonly onToggle: (stage: string) => void;
}) {
  const singleStage = stages.length === 1 ? stages[0] : undefined;
  if (stages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-muted)] px-3 py-2.5 text-sm text-[var(--color-muted-foreground)]">
        No assigned stages available.
      </div>
    );
  }
  if (singleStage) {
    return (
      <div className="inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
        {singleStage}
        <span className="ml-2 text-[10px] font-medium">
          Applied automatically
        </span>
      </div>
    );
  }
  return (
    <div data-testid="stage-checkbox-group" className="flex flex-wrap gap-2">
      {stages.map((stage) => (
        <StageChoice
          key={stage}
          stage={stage}
          checked={isSelected(stage)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

const STAGE_CHOICE_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors";
const STAGE_CHOICE_CHECKED_CLASS =
  "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]";
const STAGE_CHOICE_UNCHECKED_CLASS =
  "border-[var(--color-border-strong)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)]";

function StageChoice({
  stage,
  checked,
  onToggle,
}: {
  readonly stage: string;
  readonly checked: boolean;
  readonly onToggle: (stage: string) => void;
}) {
  return (
    <label
      className={`${STAGE_CHOICE_CLASS} ${
        checked ? STAGE_CHOICE_CHECKED_CLASS : STAGE_CHOICE_UNCHECKED_CLASS
      }`}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[var(--color-starbucks-accent)]"
        checked={checked}
        onChange={() => onToggle(stage)}
      />
      {stage}
    </label>
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
