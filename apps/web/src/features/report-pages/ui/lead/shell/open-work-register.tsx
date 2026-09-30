import { shortItemLabel } from "../../../../../shared/lib/format/short-label";
import type { OpenWorkRegisterItem } from "./open-work-register-model";
import type { OpenWorkRegisterQuery } from "./use-open-work-register";

const ACTION_BUTTON =
  "min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

function sourceLabel(item: OpenWorkRegisterItem): string {
  return item.occurrence.source === "published" ? "Published" : "Submitted";
}

function progressLabel(item: OpenWorkRegisterItem): string {
  if (item.occurrence.item.resolution != null) return "Cancelled";
  if (item.automaticPauseReason != null) return "Paused";
  switch (item.occurrence.item.workflowStatus) {
    case "paused":
      return "Paused";
    case "postponed":
      return "Postponed";
    case "planned":
      return "Planned";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
  }
}

function OpenWorkReason({ item }: { readonly item: OpenWorkRegisterItem }) {
  const historical = item.occurrence.item;
  if (historical.resolution != null) {
    return (
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        Cancellation reason: {historical.resolution.reason}
      </p>
    );
  }
  if (item.automaticPauseReason != null) {
    return (
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        Pause reason: {item.automaticPauseReason}
      </p>
    );
  }
  if (historical.workflowStatus === "paused") {
    return (
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        Pause reason: {historical.pausedReason}
      </p>
    );
  }
  if (historical.workflowStatus === "postponed") {
    return (
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Deferral reason was not recorded.
      </p>
    );
  }
  return null;
}

function OpenWorkList({
  items,
  disabled,
  onOpen,
}: {
  readonly items: readonly OpenWorkRegisterItem[];
  readonly disabled: boolean;
  readonly onOpen: (item: OpenWorkRegisterItem) => void;
}) {
  return (
    <ul className="grid min-w-0 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <OpenWorkRow
          key={item.key}
          item={item}
          disabled={disabled}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

function TerminalWorkHistory({
  items,
  disabled,
  onOpen,
}: {
  readonly items: readonly OpenWorkRegisterItem[];
  readonly disabled: boolean;
  readonly onOpen: (item: OpenWorkRegisterItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <details className="border-t border-[var(--color-border-subtle)] pt-2">
      <summary className="min-h-[var(--touch-target-min)] cursor-pointer rounded-[var(--radius-sm)] py-3 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
        Completed and cancelled work ({items.length})
      </summary>
      <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">
        Reopening creates a new occurrence in this report. Historical reports
        remain unchanged.
      </p>
      <OpenWorkList items={items} disabled={disabled} onOpen={onOpen} />
    </details>
  );
}

function OpenWorkRow({
  item,
  disabled,
  onOpen,
}: {
  readonly item: OpenWorkRegisterItem;
  readonly disabled: boolean;
  readonly onOpen: (item: OpenWorkRegisterItem) => void;
}) {
  const historical = item.occurrence.item;
  const parent = item.occurrence.parent;
  return (
    <li className="min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] p-3">
      <p className="break-words text-sm font-semibold">{historical.text}</p>
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        {parent.name ?? (parent.kind === "product" ? "Product" : "Activity")}
        {" · "}
        {progressLabel(item)} · {sourceLabel(item)} · {item.periodLabel}
      </p>
      {historical.nextStepText ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Last confirmed next step: {historical.nextStepText}
        </p>
      ) : null}
      <OpenWorkReason item={item} />
      <button
        type="button"
        disabled={disabled}
        aria-label={`${item.action.label}: ${shortItemLabel(historical.text)}`}
        data-overview-focus={`open-work:${historical.stableId}`}
        className={ACTION_BUTTON}
        onClick={() => onOpen(item)}
      >
        {item.action.label}
      </button>
    </li>
  );
}

export function OpenWorkRegister({
  query,
  actionsDisabled,
  disabledReason,
  onOpen,
}: {
  readonly query: OpenWorkRegisterQuery;
  readonly actionsDisabled: boolean;
  readonly disabledReason: string | null;
  readonly onOpen: (item: OpenWorkRegisterItem) => void;
}) {
  return (
    <section
      aria-labelledby="open-work-register-title"
      aria-busy={query.isLoading}
      className="card-surface space-y-3 p-4"
    >
      <div className="space-y-1">
        <h2
          id="open-work-register-title"
          className="text-base font-semibold text-[var(--color-foreground)]"
        >
          Open work from earlier periods
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Resume or replan work without changing its published history.
        </p>
      </div>
      {query.isLoading ? (
        <p
          role="status"
          className="text-sm text-[var(--color-muted-foreground)]"
        >
          Checking earlier periods…
        </p>
      ) : null}
      {query.error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{query.error}</p>
          <button type="button" className={ACTION_BUTTON} onClick={query.retry}>
            Retry open work
          </button>
        </div>
      ) : null}
      {query.openItems.length > 0 ? (
        <OpenWorkList
          items={query.openItems}
          disabled={actionsDisabled}
          onOpen={onOpen}
        />
      ) : query.isComplete ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No unresolved work from earlier periods.
        </p>
      ) : null}
      <TerminalWorkHistory
        items={query.terminalItems}
        disabled={actionsDisabled}
        onOpen={onOpen}
      />
      {disabledReason &&
      query.openItems.length + query.terminalItems.length > 0 ? (
        <p
          role="status"
          className="text-sm text-[var(--color-muted-foreground)]"
        >
          {disabledReason}
        </p>
      ) : null}
    </section>
  );
}
