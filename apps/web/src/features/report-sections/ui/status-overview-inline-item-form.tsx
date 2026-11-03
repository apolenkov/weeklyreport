import { useId } from "react";

import type { ItemComposerProps } from "../model/contextual-entry-contract";

const control =
  "min-h-11 w-full min-w-0 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";
const button =
  "min-h-11 rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50";

export function StatusOverviewInlineItemForm(props: ItemComposerProps) {
  const { target, view, onSubmit, onCancel } = props;
  const id = useId();
  const error = (field: string) => view.errors[field];
  const disabled = view.pending || !view.canSubmit;
  return (
    <form
      aria-label={`Add item for ${target.parent.name}, ${target.week} week`}
      aria-busy={view.pending}
      className="min-w-0 space-y-3 rounded border border-[var(--color-border)] bg-[var(--color-background)] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit("save");
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.shiftKey &&
          (event.ctrlKey || event.metaKey)
        ) {
          event.preventDefault();
          if (!disabled) onSubmit("save-and-add-another");
        }
      }}
    >
      <p className="text-sm font-medium">
        {target.parent.kind === "product" ? "Product" : "Activity"}:{" "}
        {target.parent.name} ·{" "}
        {target.week === "current" ? "Current week" : "Next week"} · Owner:{" "}
        {view.authorName}
      </p>
      {view.message && (
        <p role="alert" className="text-sm">
          {view.message}
        </p>
      )}
      {view.pending && (
        <p role="status" className="text-sm">
          Saving…
        </p>
      )}
      <TextFields {...props} id={id} />
      <ProgressFields {...props} id={id} />
      {error("parent") && (
        <p role="alert" className="text-sm">
          {error("parent")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={button} disabled={disabled}>
          Save
        </button>
        <button
          type="button"
          className={button}
          disabled={disabled}
          onClick={() => onSubmit("save-and-add-another")}
        >
          Save and add another
        </button>
      </div>
    </form>
  );
}

type FieldProps = ItemComposerProps & { readonly id: string };
function fieldHelpers(view: ItemComposerProps["view"], id: string) {
  const error = (field: string) => view.errors[field];
  const describedBy = (field: string) =>
    error(field) ? `${id}-${field}-error` : undefined;
  const fieldError = (field: string) =>
    error(field) ? (
      <p id={`${id}-${field}-error`} className="text-sm text-red-700">
        {error(field)}
      </p>
    ) : null;
  return { error, describedBy, fieldError };
}

function TextFields(props: FieldProps) {
  const { value, view, onChange, id } = props;
  const { error, describedBy, fieldError } = fieldHelpers(view, id);
  return (
    <>
      <label className="block space-y-1 text-sm">
        Description
        <textarea
          className={control}
          required
          value={value.text}
          aria-invalid={!!error("text")}
          aria-describedby={describedBy("text")}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </label>
      {fieldError("text")}
      <label className="block space-y-1 text-sm">
        Next step
        <textarea
          className={control}
          value={value.nextStepText}
          aria-invalid={!!error("nextStepText")}
          aria-describedby={describedBy("nextStepText")}
          onChange={(event) =>
            onChange({ ...value, nextStepText: event.target.value })
          }
        />
      </label>
      {fieldError("nextStepText")}
    </>
  );
}

function ProgressFields(props: FieldProps) {
  const { target, value, view, onChange, id } = props;
  const { error, describedBy, fieldError } = fieldHelpers(view, id);
  return (
    <>
      <label className="block space-y-1 text-sm">
        Progress
        <select
          className={control}
          value={value.status}
          aria-invalid={!!error("status")}
          aria-describedby={describedBy("status")}
          onChange={(event) =>
            onChange({
              ...value,
              status: event.target
                .value as ItemComposerProps["value"]["status"],
            })
          }
        >
          <option value="planned">
            {target.week === "current" ? "Not started" : "Planned"}
          </option>
          <option value="in_progress">In progress</option>
          <option value="paused">Paused</option>
          <option value="postponed">Postponed</option>
          <option value="done">Done</option>
        </select>
      </label>
      {fieldError("status")}
      {value.status === "paused" && (
        <>
          <label className="block space-y-1 text-sm">
            Pause reason
            <textarea
              className={control}
              required
              value={value.pausedReason}
              aria-invalid={!!error("pausedReason")}
              aria-describedby={describedBy("pausedReason")}
              onChange={(event) =>
                onChange({ ...value, pausedReason: event.target.value })
              }
            />
          </label>
          {fieldError("pausedReason")}
        </>
      )}
      <StageFields {...props} />
    </>
  );
}

function StageFields(props: FieldProps) {
  const { target, value, view, onChange, id } = props;
  const { describedBy, fieldError } = fieldHelpers(view, id);
  if (target.parent.kind !== "product") return null;
  return (
    <fieldset
      aria-describedby={describedBy("stageNames")}
      className="min-w-0 space-y-1 text-sm"
    >
      <legend>Stages (required)</legend>
      {view.eligibleStages.length === 0 && <p>No eligible stages available.</p>}
      {view.eligibleStages.map((stage) => (
        <label key={stage} className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={value.stageNames.includes(stage)}
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
        </label>
      ))}
      {value.stageNames
        .filter((stage) => !view.eligibleStages.includes(stage))
        .map((stage) => (
          <p key={stage}>Unavailable stage: {stage}</p>
        ))}
      {fieldError("stageNames")}
    </fieldset>
  );
}
