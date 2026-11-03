import { useId } from "react";

import type { RiskComposerProps } from "../model/contextual-entry-contract";

export function StatusOverviewInlineRiskForm({
  target,
  value,
  view,
  onChange,
  onSubmit,
  onCancel,
}: RiskComposerProps) {
  const id = useId();
  return (
    <form
      aria-label={`Add risk to ${target.parent.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (view.canSubmit && !view.pending) onSubmit();
      }}
      className="grid min-w-0 gap-3"
    >
      <strong>{target.parent.name}</strong>
      {(
        [
          ["text", "Risk"],
          ["impact", "Impact"],
          ["mitigation", "Mitigation"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="grid gap-1">
          {label}
          <textarea
            aria-label={label}
            required
            value={value[key]}
            disabled={view.pending}
            aria-invalid={!!view.errors[key]}
            aria-describedby={view.errors[key] ? `${id}-${key}` : undefined}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
            className="min-w-0 rounded border p-2"
          />
          {view.errors[key] && (
            <span id={`${id}-${key}`}>{view.errors[key]}</span>
          )}
        </label>
      ))}
      <label className="grid gap-1">
        Severity
        <select
          value={value.severity}
          disabled={view.pending}
          aria-invalid={!!view.errors.severity}
          aria-describedby={view.errors.severity ? `${id}-severity` : undefined}
          onChange={(event) =>
            onChange({
              ...value,
              severity: event.target.value as typeof value.severity,
            })
          }
          className="min-h-11 rounded border p-2"
        >
          <option value="at-risk">At risk</option>
          <option value="blocked">Blocked</option>
        </select>
        {view.errors.severity && (
          <span id={`${id}-severity`}>{view.errors.severity}</span>
        )}
      </label>
      {target.parent.kind === "product" && (
        <OwnedStages value={value} view={view} onChange={onChange} id={id} />
      )}
      {view.message && <p role="alert">{view.message}</p>}
      {view.pending && <p role="status">Saving risk…</p>}
      <Actions view={view} onCancel={onCancel} />
    </form>
  );
}

function OwnedStages({
  value,
  view,
  onChange,
  id,
}: Pick<RiskComposerProps, "value" | "view" | "onChange"> & { id: string }) {
  const stages = [...new Set([...view.eligibleStages, ...value.stageNames])];
  return (
    <fieldset
      aria-describedby={view.errors.stageNames ? `${id}-stages` : undefined}
    >
      <legend>Owned stages (required)</legend>
      {view.eligibleStages.length === 0 && (
        <p>No eligible owned stages available.</p>
      )}
      {stages.map((stage) => (
        <label key={stage} className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={value.stageNames.includes(stage)}
            disabled={view.pending}
            onChange={(event) =>
              onChange({
                ...value,
                stageNames: event.target.checked
                  ? [...value.stageNames, stage]
                  : value.stageNames.filter((name) => name !== stage),
              })
            }
          />
          {stage}
          {!view.eligibleStages.includes(stage) && " (no longer eligible)"}
        </label>
      ))}
      {view.errors.stageNames && (
        <p id={`${id}-stages`}>{view.errors.stageNames}</p>
      )}
    </fieldset>
  );
}

function Actions({
  view,
  onCancel,
}: Pick<RiskComposerProps, "view" | "onCancel">) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={!view.canSubmit || view.pending}
        className="min-h-11 rounded border px-3"
      >
        Save risk
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 rounded border px-3"
      >
        Cancel
      </button>
    </div>
  );
}
