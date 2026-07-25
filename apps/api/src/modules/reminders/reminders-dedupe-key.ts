// Single shape every requestReminderExecution caller must agree on:
// `${ruleId}:${kind}:${cycleDate}:${recipientEmail}`.

const ISO_DATE_LENGTH = 10;

export type ReminderDedupeKeyKind = "deadline" | "escalation";

export interface ReminderDedupeKeyParts {
  ruleId: string;
  kind: ReminderDedupeKeyKind;
  cycleDate: string;
  recipientEmail: string;
}

/**
 * Build Reminder Dedupe Key.
 * @param parts - The parts argument.
 */
export function buildReminderDedupeKey(parts: ReminderDedupeKeyParts): string {
  return `${parts.ruleId}:${parts.kind}:${parts.cycleDate}:${parts.recipientEmail}`;
}

/**
 * To Reminder Cycle Date.
 * @param fireAt - The fireAt argument.
 */
export function toReminderCycleDate(fireAt: Date): string {
  return fireAt.toISOString().slice(0, ISO_DATE_LENGTH);
}

// Manual dispatch defaults to deadline + fireAt cycle so it collides with
// an already-sent automated reminder for the same rule/recipient/day.
/**
 * Resolve Reminder Dedupe Key.
 * @param rule - The rule argument.
 * @param recipientEmail - The recipientEmail argument.
 * @param payload - The payload argument.
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
