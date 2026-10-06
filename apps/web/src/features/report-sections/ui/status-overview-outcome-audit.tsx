import type { StatusOverviewItem } from "../model/status-overview";

const OUTCOME_LABELS = {
  done: "Completed",
  continue: "Continued",
  plan_next: "Moved to next week",
  promote: "Moved to this week",
  restore: "Restored plan",
  wont_do: "Marked Won't do",
} as const;

function auditTimestamp(occurredAt: string): string {
  return occurredAt.replace("T", " ").replace(/:\d{2}(?:\.\d+)?Z$/, " UTC");
}

// A transition that replaced the result keeps the superseded text in the
// event's before-state; surface it instead of leaving only a transition label.
function supersededText(event: {
  readonly afterState: { readonly text?: string | null };
  readonly beforeState: { readonly text?: string | null };
}): string | null {
  const before = event.beforeState.text?.trim() ?? "";
  if (before === "" || before === event.afterState.text?.trim()) return null;
  return before;
}

export function OutcomeAudit({ item }: { readonly item: StatusOverviewItem }) {
  const resolution = item.resolution;
  const events = item.outcomeHistory;
  if (resolution === null && events.length === 0) return null;
  return (
    <details className="text-xs text-[var(--color-muted-foreground)]">
      <summary className="flex min-h-[var(--touch-target-min)] cursor-pointer items-center rounded-[var(--radius-sm)] px-1 font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
        <span>History</span>
        {events.length > 0 ? (
          <span>{` · ${String(events.length)}`}</span>
        ) : null}
      </summary>
      <ul className="space-y-1 px-1 pb-1">
        {events.length > 0 ? (
          events.map((event) => (
            <li key={event.id} className="break-words">
              {OUTCOME_LABELS[event.outcome]} by {event.actorName} ·{" "}
              {auditTimestamp(event.occurredAt)}
              {event.reason ? ` · ${event.reason}` : ""}
              {supersededText(event)
                ? ` · Previous: ${supersededText(event) ?? ""}`
                : ""}
            </li>
          ))
        ) : resolution ? (
          <li className="break-words">
            Marked Won&apos;t do by {resolution.actorName} ·{" "}
            {auditTimestamp(resolution.occurredAt)}
          </li>
        ) : null}
      </ul>
    </details>
  );
}
