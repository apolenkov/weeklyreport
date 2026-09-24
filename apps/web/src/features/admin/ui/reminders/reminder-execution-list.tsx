import { formatDateTime } from "../../../../shared/lib/format/format-date";
import type { AdminReminderExecutionView } from "../../model/admin-types";

interface ReminderExecutionListProps {
  readonly executions: readonly AdminReminderExecutionView[];
}

const STATUS_LABELS: Record<AdminReminderExecutionView["status"], string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};

function statusClass(status: AdminReminderExecutionView["status"]): string {
  switch (status) {
    case "sent":
      return "bg-[var(--color-success)] text-[var(--color-success-foreground)]";
    case "failed":
      return "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]";
    case "sending":
      return "bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]";
    case "queued":
      return "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
  }
}

export function ReminderExecutionList({
  executions,
}: ReminderExecutionListProps) {
  return (
    <section
      aria-labelledby="reminder-execution-heading"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card-compact)]"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="reminder-execution-heading"
            className="text-base font-semibold text-[var(--color-foreground)]"
          >
            Delivery activity
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Recent reminder attempts and their confirmed delivery state.
          </p>
        </div>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {executions.length}{" "}
          {executions.length === 1 ? "execution" : "executions"}
        </span>
      </div>

      {executions.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-muted-foreground)]">
          No reminder deliveries yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Reminder delivery activity</caption>
            <thead className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Recipient
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Scheduled
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Sent
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {executions.map((execution) => (
                <tr
                  key={execution.id}
                  data-testid={`reminder-execution-${execution.id}`}
                >
                  <td className="px-3 py-3 font-medium text-[var(--color-foreground)]">
                    {execution.recipientEmail}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--color-muted-foreground)]">
                    {formatDateTime(execution.scheduledFor)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-[var(--radius-pill)] px-2 py-1 text-xs font-semibold ${statusClass(execution.status)}`}
                    >
                      {STATUS_LABELS[execution.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--color-muted-foreground)]">
                    {execution.sentAt ? formatDateTime(execution.sentAt) : "—"}
                  </td>
                  <td className="max-w-[18rem] px-3 py-3 text-[var(--color-destructive)]">
                    {execution.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
