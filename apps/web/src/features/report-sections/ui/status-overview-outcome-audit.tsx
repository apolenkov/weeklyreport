import type { StatusOverviewItem } from "../model/status-overview";

const OUTCOME_LABELS = {
  done: "Completed",
  continue: "Continued",
  plan_next: "Planned next step",
  restore: "Restored plan",
  wont_do: "Marked Won't do",
} as const;

function auditTimestamp(occurredAt: string): string {
  return occurredAt.replace("T", " ").replace(/:\d{2}(?:\.\d+)?Z$/, " UTC");
}

export function OutcomeAudit({ item }: { readonly item: StatusOverviewItem }) {
  const resolution = item.resolution ?? null;
  const events = item.outcomeHistory ?? [];
  if (resolution === null && events.length === 0) return null;
  return (
    <details className="text-xs text-[var(--color-muted-foreground)]">
      <summary className="flex min-h-[var(--touch-target-min)] cursor-pointer items-center rounded-[var(--radius-sm)] px-1 font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
        Outcome history
      </summary>
      <ul className="space-y-1 px-1 pb-1">
        {events.length > 0 ? (
          events.map((event) => (
            <li key={event.id} className="break-words">
              {OUTCOME_LABELS[event.outcome]} by {event.actorName} ·{" "}
              {auditTimestamp(event.occurredAt)}
              {event.reason ? ` · ${event.reason}` : ""}
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
