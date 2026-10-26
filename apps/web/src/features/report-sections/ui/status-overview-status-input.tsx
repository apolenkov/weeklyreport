"use client";

import { useEffect, useRef } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import { ReasonRow } from "./status-overview-reason-row";

const ACTION_CLASS =
  "min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50";

export interface StatusInputFlow {
  readonly asking: "paused" | "done" | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly pause: (reason: string) => void;
  readonly finish: (action: "clear" | "plan") => void;
  readonly cancel: () => void;
}

function CompletionChoice({ flow }: { readonly flow: StatusInputFlow }) {
  const firstAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!flow.busy) firstAction.current?.focus();
  }, [flow.busy]);
  return (
    <div
      role="group"
      aria-busy={flow.busy}
      aria-label="Resolve next step before marking done"
      data-testid="overview-status-next-step"
      className="min-w-0 space-y-1"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !flow.busy) {
          event.preventDefault();
          event.stopPropagation();
          flow.cancel();
        }
      }}
    >
      <p className="text-sm">Mark done. Next step →</p>
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        Clear marks this result done. Plan moves the next step to Next week
        instead; the current result stays in history and its status is
        unchanged.
      </p>
      <div className="flex flex-wrap gap-1">
        <button
          ref={firstAction}
          type="button"
          disabled={flow.busy}
          onClick={() => flow.finish("plan")}
          className={ACTION_CLASS}
        >
          Plan for next week
        </button>
        <button
          type="button"
          disabled={flow.busy}
          onClick={() => flow.finish("clear")}
          className={ACTION_CLASS}
        >
          Clear
        </button>
        <button
          type="button"
          disabled={flow.busy}
          onClick={flow.cancel}
          className={ACTION_CLASS}
        >
          Cancel
        </button>
      </div>
      {flow.error ? (
        <p role="alert" className="text-xs text-[var(--color-destructive)]">
          {flow.error}
        </p>
      ) : null}
    </div>
  );
}

export function StatusInput({
  item,
  flow,
}: {
  readonly item: StatusOverviewItem;
  readonly flow: StatusInputFlow;
}) {
  if (flow.asking === "paused")
    return (
      <ReasonRow
        label={`Paused reason — ${item.text}`}
        placeholder="Pause reason"
        busy={flow.busy}
        error={flow.error}
        onSubmit={flow.pause}
        onCancel={flow.cancel}
      />
    );
  if (flow.asking === "done") return <CompletionChoice flow={flow} />;
  return flow.error ? (
    <p role="alert" className="text-xs text-[var(--color-destructive)]">
      {flow.error}
    </p>
  ) : null;
}
