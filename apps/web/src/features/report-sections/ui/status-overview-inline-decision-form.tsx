import { useId } from "react";

import type { DecisionComposerProps } from "../model/contextual-entry-contract";

export function StatusOverviewInlineDecisionForm({
  target,
  value,
  view,
  onChange,
  onSubmit,
  onCancel,
}: DecisionComposerProps) {
  const id = useId();
  return (
    <form
      aria-label={`Add decision to ${target.parent.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (view.canSubmit && !view.pending) onSubmit();
      }}
      className="grid min-w-0 gap-3"
    >
      <strong>{target.parent.name}</strong>
      {(
        [
          ["text", "Decision"],
          ["impact", "Impact"],
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
        Deadline (optional)
        <input
          type="date"
          value={value.deadline}
          disabled={view.pending}
          aria-invalid={!!view.errors.deadline}
          aria-describedby={view.errors.deadline ? `${id}-deadline` : undefined}
          onChange={(event) =>
            onChange({ ...value, deadline: event.target.value })
          }
          className="min-h-11 min-w-0 rounded border p-2"
        />
        {view.errors.deadline && (
          <span id={`${id}-deadline`}>{view.errors.deadline}</span>
        )}
      </label>
      <p>
        Author: <strong>{view.authorName}</strong>
      </p>
      {view.errors.authorName && <p role="alert">{view.errors.authorName}</p>}
      {target.parent.kind === "product" && (
        <OwnedStages value={value} view={view} onChange={onChange} id={id} />
      )}
      {view.message && <p role="alert">{view.message}</p>}
      {view.pending && <p role="status">Saving decision…</p>}
      <Actions view={view} onCancel={onCancel} />
    </form>
  );
}

function OwnedStages({
  value,
  view,
  onChange,
  id,
}: Pick<DecisionComposerProps, "value" | "view" | "onChange"> & {
  id: string;
}) {
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
}: Pick<DecisionComposerProps, "view" | "onCancel">) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={!view.canSubmit || view.pending}
        className="min-h-11 rounded border px-3"
      >
        Save decision
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
