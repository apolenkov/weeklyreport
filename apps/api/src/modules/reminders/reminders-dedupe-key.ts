// Single shape every requestReminderExecution caller must agree on:
// `${ruleId}:${kind}:${cycleDate}:${recipientEmail}`.

const ISO_DATE_LENGTH = 10;

export type ReminderDedupeKeyKind = "deadline" | "escalation";

export interface ReminderDedupeKeyParts {
  readonly ruleId: string;
  readonly kind: ReminderDedupeKeyKind;
  readonly cycleDate: string;
  readonly recipientEmail: string;
}

export function buildReminderDedupeKey(parts: ReminderDedupeKeyParts): string {
  return `${parts.ruleId}:${parts.kind}:${parts.cycleDate}:${parts.recipientEmail}`;
}

export function toReminderCycleDate(fireAt: Date): string {
  return fireAt.toISOString().slice(0, ISO_DATE_LENGTH);
}

// Manual dispatch defaults to deadline + fireAt cycle so it collides with
// an already-sent automated reminder for the same rule/recipient/day.
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
