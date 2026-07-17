/**
 * The single dedupe-key shape every `requestReminderExecution` caller must
 * agree on: `${ruleId}:${kind}:${cycleDate}:${recipientEmail}`. Two callers
 * computing this shape independently is how the scheduler's automated
 * `deadline` tick and a head-triggered manual `Remind` drifted into two keys
 * that could never collide for the same rule/recipient/cycle.
 */

/** Length of an ISO calendar date (`YYYY-MM-DD`) after `toISOString().slice(0, n)`. */
const ISO_DATE_LENGTH = 10;

export type ReminderDedupeKeyKind = "deadline" | "escalation";

export interface ReminderDedupeKeyParts {
  ruleId: string;
  kind: ReminderDedupeKeyKind;
  cycleDate: string;
  recipientEmail: string;
}

export function buildReminderDedupeKey(parts: ReminderDedupeKeyParts): string {
  return `${parts.ruleId}:${parts.kind}:${parts.cycleDate}:${parts.recipientEmail}`;
}

/** The UTC calendar date (`YYYY-MM-DD`) a rule's `fireAt` falls in. */
export function toReminderCycleDate(fireAt: Date): string {
  return fireAt.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * The dedupe key `requestReminderExecution` uses for `rule`/`recipientEmail`
 * — also the key any caller must mirror locally for a race-safe read-back
 * against the same call. A scheduler tick supplies its own kind/cycleDate
 * via `payload`; a no-payload manual dispatch defaults to `kind: "deadline"`
 * with cycleDate derived from the rule's own `fireAt`, so it collides with
 * an already-sent automated reminder for the same rule/recipient/day.
 */
export function resolveReminderDedupeKey(
  rule: { id: string; fireAt: Date },
  recipientEmail: string,
  payload?: { kind: ReminderDedupeKeyKind; cycleDate: string },
): string {
  return buildReminderDedupeKey({
    ruleId: rule.id,
    kind: payload?.kind ?? "deadline",
    cycleDate: payload?.cycleDate ?? toReminderCycleDate(rule.fireAt),
    recipientEmail,
  });
}
