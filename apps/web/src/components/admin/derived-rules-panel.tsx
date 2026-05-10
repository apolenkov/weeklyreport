"use client";

import type { MockPeriod, MockReminder } from "./mock-data";

/**
 * UFB-036 (Phase 44-04): read-only panel showing the per-period
 * `ReminderRule` rows derived by `PolicyApplicatorService` for a given
 * policy. The panel renders inside an expander on each policy row in
 * the Reminders Tab; the rules are NOT editable here — admins edit the
 * policy template above and the applicator regenerates rules.
 *
 * Empty state: when a policy has not yet produced any derived rules
 * (e.g. policy was just created and no period has matched its validity
 * window) we show a short hint instead of an empty table.
 */
export type DerivedRulesPanelProps = {
  readonly policyId: string;
  readonly rules: ReadonlyArray<MockReminder>;
  readonly periodById: ReadonlyMap<string, MockPeriod>;
};

export function DerivedRulesPanel({
  policyId,
  rules,
  periodById,
}: DerivedRulesPanelProps) {
  if (rules.length === 0) {
    return (
      <div
        data-testid={`derived-rules-empty-${policyId}`}
        className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-3 text-xs text-[var(--color-muted-foreground)]"
      >
        No derived rules yet. Create a report period whose deadline falls
        inside the policy's validity window to generate rules.
      </div>
    );
  }

  return (
    <div
      data-testid={`derived-rules-${policyId}`}
      className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white"
    >
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-surface-empty)] text-left uppercase tracking-wider text-[10px] text-[var(--color-muted-foreground)]">
          <tr>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Fires at</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => {
            const period = rule.reportId
              ? periodById.get(rule.reportId)
              : undefined;
            return (
              <tr
                key={rule.id}
                className="border-t border-[var(--color-border)]"
              >
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-foreground)]">
                  {period
                    ? `${period.weekLabel} (${period.startDate} → ${period.endDate})`
                    : "(unbound)"}
                </td>
                <td className="px-3 py-2">{rule.kind}</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {formatFireAt(rule.fireAt, rule.timezone)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: rule.active
                        ? "var(--color-success)"
                        : "var(--color-muted)",
                      color: rule.active
                        ? "var(--color-primary)"
                        : "var(--color-muted-foreground)",
                    }}
                  >
                    {rule.active ? "Active" : "Paused"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatFireAt(fireAt: Date, tz: string): string {
  const iso = fireAt.toISOString();
  // YYYY-MM-DD HH:MM (UTC) · tz
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC · ${tz}`;
}
