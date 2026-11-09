import { useRef, useState } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import { type ActionProps, identityOf } from "./status-overview-item-actions";

export function canSetStages({
  item,
  onSetStages,
  ownedStages,
}: ActionProps): boolean {
  return Boolean(
    onSetStages &&
    ownedStages?.length &&
    item.editTarget &&
    item.source !== "previous" &&
    item.workflowStatus !== "done" &&
    !item.editTarget.focusNextStep &&
    !item.needsConfirmation,
  );
}

export function StageControl(props: ActionProps) {
  const { item, onSetStages, ownedStages = [] } = props;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (!canSetStages(props) || !onSetStages) return null;
  const focusKey = `stage:${item.source}:${identityOf(item)}`;
  const invalid =
    item.stageNames.length === 0 ||
    item.stageNames.some((name) => !ownedStages.includes(name));
  const toggle = async (name: string) => {
    if (busy.current || invalid) return;
    const next = item.stageNames.includes(name)
      ? item.stageNames.filter((stage) => stage !== name)
      : [...item.stageNames, name];
    if (next.length === 0) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      setError((await onSetStages(item, next, focusKey)) ?? null);
    } catch {
      setError("Could not update stages. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div
      role="group"
      aria-label={`Stages for ${shortItemLabel(item.text)}`}
      className="space-y-1"
    >
      <div className="flex flex-wrap gap-1">
        {ownedStages.map((name) => {
          const selected = item.stageNames.includes(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              disabled={
                pending || invalid || (selected && item.stageNames.length === 1)
              }
              data-overview-focus={focusKey}
              onClick={() => void toggle(name)}
              className={`min-h-[var(--touch-target-min)] max-w-full rounded-[var(--radius-sm)] border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] ${selected ? "border-[var(--color-primary)] bg-[var(--color-muted)] text-[var(--color-foreground)]" : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"}`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {invalid ? (
        <p role="alert" className="text-xs text-[var(--color-destructive)]">
          Stages are out of date. Open the item editor to review them.
        </p>
      ) : item.stageNames.length === 1 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          A Product item keeps at least one stage
        </p>
      ) : null}
      {pending ? (
        <p role="status" className="text-xs">
          Saving stages…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
