import {
  HOURS_PER_DAY,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
} from "@customreport/shared";

import { formatDateWithYear, toIsoDateString } from "../../../lib/format-date";
import { pluralize } from "../../../lib/pluralize";
import type { MockReminder, MockReminderPolicy } from "./admin-types";

const MAX_HOUR_OFFSET_DAYS = 2;
const MAX_HOUR_OFFSET_MINUTES =
  MAX_HOUR_OFFSET_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR;

// Meaningful (kind, audience) pairings; unmatched rows surface as "Custom".
export const REMINDER_PRESETS = [
  {
    value: "deadline-leads",
    label: "Deadline reminder to leads",
    kind: "deadline",
    audience: "lead-with-draft",
  },
  {
    value: "escalation-head",
    label: "Escalation digest to head",
    kind: "escalation",
    audience: "head-of-late",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  kind: MockReminderPolicy["kind"];
  audience: MockReminderPolicy["audience"];
}[];

export type ReminderPreset = (typeof REMINDER_PRESETS)[number]["value"];
export type ReminderPresetChoice = ReminderPreset | "custom";

export const CUSTOM_PRESET_LABEL = "Custom";

/**
 * Preset For Policy.
 * @param kind - The kind argument.
 * @param audience - The audience argument.
 */
export function presetForPolicy(
  kind: MockReminderPolicy["kind"],
  audience: MockReminderPolicy["audience"],
): ReminderPresetChoice {
  const match = REMINDER_PRESETS.find(
    (preset) => preset.kind === kind && preset.audience === audience,
  );
  return match ? match.value : "custom";
}

/**
 * Preset Pairing.
 * @param preset - The preset argument.
 */
export function presetPairing(preset: ReminderPreset): {
  kind: MockReminderPolicy["kind"];
  audience: MockReminderPolicy["audience"];
} {
  const found = REMINDER_PRESETS.find((p) => p.value === preset);
  if (!found) {
    throw new Error(`Unknown reminder preset: ${preset}`);
  }
  return { kind: found.kind, audience: found.audience };
}

/**
 * Describe Recipient.
 * @param audience - The audience argument.
 */
export function describeRecipient(
  audience: MockReminderPolicy["audience"],
): string {
  switch (audience) {
    case "lead-with-draft":
      return "Notifies leads who still owe a report";
    case "head-of-late":
      return "Sends the department head a digest of late leads";
  }
}

export type OffsetUnit = "minutes" | "hours" | "days";

/**
 * Offset Unit Factor.
 * @param unit - The unit argument.
 */
export function offsetUnitFactor(unit: OffsetUnit): number {
  switch (unit) {
    case "minutes":
      return 1;
    case "hours":
      return MINUTES_PER_HOUR;
    case "days":
      return MINUTES_PER_DAY;
  }
}

/**
 * Get Offset Unit.
 * @param minutes - The minutes argument.
 */
export function getOffsetUnit(minutes: number): OffsetUnit {
  const abs = Math.abs(minutes);
  if (abs > 0 && abs % MINUTES_PER_HOUR === 0 && abs <= MAX_HOUR_OFFSET_MINUTES)
    return "hours";
  if (abs > 0 && abs % MINUTES_PER_DAY === 0) return "days";
  if (abs > 0 && abs % MINUTES_PER_HOUR === 0) return "hours";
  return "minutes";
}

/**
 * Get Offset Amount.
 * @param minutes - The minutes argument.
 * @param unit - The unit argument.
 */
export function getOffsetAmount(minutes: number, unit: OffsetUnit): number {
  return Math.abs(minutes) / offsetUnitFactor(unit);
}

/**
 * Format Policy Timing.
 * @param policy - The policy argument.
 */
export function formatPolicyTiming(policy: MockReminderPolicy): string {
  const minutes = policy.offsetMinutes;
  if (minutes === 0) return "At deadline";

  const abs = Math.abs(minutes);
  const direction = minutes < 0 ? "before" : "after";

  if (abs % MINUTES_PER_HOUR === 0 && abs <= MAX_HOUR_OFFSET_MINUTES) {
    const hours = abs / MINUTES_PER_HOUR;
    return `${hours} ${pluralize(hours, "hour", "hours")} ${direction} deadline`;
  }

  if (abs % MINUTES_PER_DAY === 0) {
    const days = abs / MINUTES_PER_DAY;
    return `${days} ${pluralize(days, "day", "days")} ${direction} deadline`;
  }

  return `${abs} ${pluralize(abs, "minute", "minutes")} ${direction} deadline`;
}

/**
 * Format Validity Window.
 * @param policy - The policy argument.
 */
export function formatValidityWindow(policy: MockReminderPolicy): string {
  const from = toIsoDateString(policy.validFrom);
  if (policy.validUntil === null) {
    return `Valid since ${from} · no end date`;
  }
  const until = toIsoDateString(policy.validUntil);
  return `${from} → ${until}`;
}

// Earliest future active fire; pure (caller passes `now`). null → no upcoming.
/**
 * Next Send Date.
 * @param rules - The rules argument.
 * @param now - The now argument.
 */
export function nextSendDate(
  rules: readonly MockReminder[],
  now: Date,
): string | null {
  const upcoming = rules
    .filter((rule) => rule.active && rule.fireAt.getTime() > now.getTime())
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  const next = upcoming.at(0);
  if (!next) return null;
  return formatDateWithYear(next.fireAt);
}
