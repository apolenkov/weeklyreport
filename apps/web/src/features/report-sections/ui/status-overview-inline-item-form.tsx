import { useId, useState } from "react";

import type { ItemComposerProps } from "../model/contextual-entry-contract";
import {
  control,
  fieldHelpers,
  type FieldProps,
  TextFields,
} from "./status-overview-inline-item-text-field";

const button =
  "min-h-11 rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50";

function statusLabel(
  status: ItemComposerProps["value"]["status"],
  week: ItemComposerProps["target"]["week"],
) {
  const labels = {
    planned: week === "current" ? "Not started" : "Planned",
    in_progress: "In progress",
    paused: "Paused",
    postponed: "Postponed",
    done: "Done",
  } satisfies Record<ItemComposerProps["value"]["status"], string>;
  return labels[status];
}

export function StatusOverviewInlineItemForm(props: ItemComposerProps) {
  const { target, view, onSubmit, onCancel } = props;
  const id = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const needsDetails = Boolean(
    view.errors.nextStepText ||
    view.errors.status ||
    view.errors.pausedReason ||
    (props.value.status === "paused" && !props.value.pausedReason.trim()),
  );
  const expanded = detailsOpen || needsDetails;
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
      <StageFields {...props} id={id} />
      <p className="text-sm">
        Progress: {statusLabel(props.value.status, target.week)}
      </p>
      <button
        type="button"
        className={button}
        aria-expanded={expanded}
        aria-controls={`${id}-details`}
        onClick={() => setDetailsOpen(!expanded)}
      >
        Details
      </button>
      {expanded && (
        <div id={`${id}-details`} className="space-y-3">
          <AdvancedFields {...props} id={id} />
          <ProgressFields {...props} id={id} />
        </div>
      )}
      {error("parent") && (
        <p role="alert" className="text-sm">
          {error("parent")}
        </p>
      )}
      <Actions disabled={disabled} onCancel={onCancel} onSubmit={onSubmit} />
    </form>
  );
}

function Actions({
  disabled,
  onCancel,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly onCancel: ItemComposerProps["onCancel"];
  readonly onSubmit: ItemComposerProps["onSubmit"];
}) {
  return (
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
  );
}

function AdvancedFields(props: FieldProps) {
  const { value, view, onChange, id } = props;
  const { error, describedBy, fieldError } = fieldHelpers(view, id);
  return (
    <>
      <label className="block space-y-1 text-sm">
        Next step
        <textarea
          name="nextStepText"
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
              name="pausedReason"
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
    </>
  );
}

function StageFields(props: FieldProps) {
  const { target, value, view, onChange, id } = props;
  const { describedBy, fieldError } = fieldHelpers(view, id);
  if (target.parent.kind !== "product") return null;
  return (
    <fieldset
      name="stageNames"
      tabIndex={view.eligibleStages.length === 0 ? 0 : undefined}
      aria-describedby={
        [
          view.eligibleStages.length === 0 ? `${id}-no-stages` : undefined,
          describedBy("stageNames"),
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      className="min-w-0 space-y-1 text-sm"
    >
      <legend>Stages (required)</legend>
      {view.eligibleStages.length === 0 && (
        <p id={`${id}-no-stages`}>No eligible stages available.</p>
      )}
      {view.eligibleStages.map((stage) => (
        <label key={stage} className="flex min-h-11 items-center gap-2">
          <input
            name="stageNames"
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
          <div
            key={stage}
            className="flex min-h-11 flex-wrap items-center gap-2"
          >
            <span>Unavailable stage: {stage}</span>
            <button
              type="button"
              className={button}
              aria-label={`Remove unavailable stage ${stage}`}
              onClick={() =>
                onChange({
                  ...value,
                  stageNames: value.stageNames.filter((name) => name !== stage),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      {fieldError("stageNames")}
    </fieldset>
  );
}
