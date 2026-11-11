import { type RefObject, useId, useState } from "react";

import type { RiskComposerProps } from "../model/contextual-entry-contract";
import { useFocusOnMount } from "./use-focus-on-mount";

const control =
  "min-h-11 w-full min-w-0 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50 sm:text-sm";
const button =
  "min-h-11 rounded border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50";
type FieldProps = RiskComposerProps & { readonly id: string };

export function StatusOverviewInlineRiskForm(props: RiskComposerProps) {
  const { target, view, onSubmit, onCancel } = props;
  const id = useId();
  const primary = useFocusOnMount<HTMLTextAreaElement>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const needsDetails = Boolean(view.errors.impact || view.errors.mitigation);
  // Latch error-opened fields so correcting the error cannot unmount typing.
  if (needsDetails && !detailsOpen) setDetailsOpen(true);
  const expanded = detailsOpen;
  return (
    <form
      autoComplete="off"
      aria-label={`Add risk to ${target.parent.name}`}
      aria-busy={view.pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (view.canSubmit && !view.pending) onSubmit();
      }}
      className="grid min-w-0 gap-3 rounded border border-[var(--color-border)] bg-[var(--color-background)] p-3"
    >
      <p className="text-sm [overflow-wrap:anywhere]">
        {target.parent.kind === "product" ? "Product" : "Activity"}:{" "}
        <strong>{target.parent.name}</strong> · Author:{" "}
        <strong>{view.authorName}</strong>
      </p>
      <TextField {...props} id={id} field="text" inputRef={primary} />
      <Severity {...props} id={id} />
      {target.parent.kind === "product" && (
        <OwnedStages
          value={props.value}
          view={view}
          onChange={props.onChange}
          id={id}
        />
      )}
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Impact and mitigation can be added later. Complete both before
        submitting your section.
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
        <div id={`${id}-details`} className="grid min-w-0 gap-3">
          <TextField {...props} id={id} field="impact" />
          <TextField {...props} id={id} field="mitigation" />
        </div>
      )}
      {[
        "parent",
        "identity",
        "authorName",
        ...(target.parent.kind === "activity" ? ["stageNames"] : []),
      ].map(
        (field) =>
          view.errors[field] && (
            <p key={field} role="alert" className="text-sm">
              {view.errors[field]}
            </p>
          ),
      )}
      {view.message && (
        <p role="alert" className="text-sm">
          {view.message}
        </p>
      )}
      {view.pending && (
        <p role="status" className="text-sm">
          Saving risk…
        </p>
      )}
      <Actions view={view} onCancel={onCancel} />
    </form>
  );
}

function TextField({
  value,
  view,
  onChange,
  id,
  field,
  inputRef,
}: FieldProps & {
  readonly field: "text" | "impact" | "mitigation";
  readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const label =
    field === "text" ? "Risk" : field === "impact" ? "Impact" : "Mitigation";
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      {label}
      {field !== "text" && " (optional for draft)"}
      <textarea
        ref={inputRef}
        name={field}
        aria-label={label}
        required={field === "text"}
        rows={2}
        value={value[field] ?? ""}
        disabled={view.pending}
        aria-invalid={!!view.errors[field]}
        aria-describedby={view.errors[field] ? `${id}-${field}` : undefined}
        onChange={(event) =>
          onChange({
            ...value,
            [field]:
              field === "text"
                ? event.target.value
                : event.target.value || null,
          })
        }
        className={control}
      />
      {view.errors[field] && (
        <span id={`${id}-${field}`}>{view.errors[field]}</span>
      )}
    </label>
  );
}

function Severity({ value, view, onChange, id }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm">
      Severity
      <select
        name="severity"
        value={value.severity}
        required
        disabled={view.pending}
        aria-invalid={!!view.errors.severity}
        aria-describedby={view.errors.severity ? `${id}-severity` : undefined}
        onChange={(event) =>
          onChange({
            ...value,
            severity: event.target.value as typeof value.severity,
          })
        }
        className={control}
      >
        <option value="at-risk">At risk</option>
        <option value="blocked">Blocked</option>
      </select>
      {view.errors.severity && (
        <span id={`${id}-severity`}>{view.errors.severity}</span>
      )}
    </label>
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
      className="min-w-0 text-sm"
      aria-invalid={!!view.errors.stageNames}
      aria-describedby={view.errors.stageNames ? `${id}-stages` : undefined}
    >
      <legend>Owned stages (required)</legend>
      {view.eligibleStages.length === 0 && (
        <p>No eligible owned stages available.</p>
      )}
      {stages.map((stage) => (
        <label
          key={stage}
          className="flex min-h-11 items-center gap-2 [overflow-wrap:anywhere]"
        >
          <input
            type="checkbox"
            name="stageNames"
            value={stage}
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
        className={button}
      >
        Save risk
      </button>
      <button type="button" onClick={onCancel} className={button}>
        Cancel
      </button>
    </div>
  );
}
