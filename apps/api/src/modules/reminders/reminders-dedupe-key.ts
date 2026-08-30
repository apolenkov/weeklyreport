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

export function resolveReminderDedupeKey(
  rule: { id: string },
  recipientEmail: string,
  payload: { kind: ReminderDedupeKeyKind; cycleDate: string },
): string {
  return buildReminderDedupeKey({
    ruleId: rule.id,
    kind: payload.kind,
    cycleDate: payload.cycleDate,
    recipientEmail,
  });
}
