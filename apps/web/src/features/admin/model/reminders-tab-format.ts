/**
 * Pure display helpers + the Reminder-type preset model for the Reminders
 * tab. No JSX, no React state — safe to import from both the tab and its
 * sub-components.
 */

import {
  HOURS_PER_DAY,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
} from "@customreport/shared";

import { monthShortLabel } from "../../../lib/format-date";
import { pluralize } from "../../../lib/pluralize";
import type { MockReminder, MockReminderPolicy } from "./admin-types";

const ISO_DATE_LENGTH = 10;
const MAX_HOUR_OFFSET_DAYS = 2;
const MAX_HOUR_OFFSET_MINUTES =
  MAX_HOUR_OFFSET_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR;

/**
 * A Reminder type preset is one of the two meaningful (kind, audience)
 * pairings the engine supports. The admin picks a preset; on save it
 * expands back into the stored `kind` + `audience` fields. A stored row
 * whose pairing matches neither preset is surfaced read-only as "Custom"
 * rather than silently coerced (D3).
 */
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
/** The form's preset field: a real preset, or "custom" for a legacy pairing. */
export type ReminderPresetChoice = ReminderPreset | "custom";

export const CUSTOM_PRESET_LABEL = "Custom";

/**
 * Resolve a stored (kind, audience) pairing to its preset, or "custom" when
 * it matches neither preset.
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

/** Expand a preset back into the (kind, audience) the engine stores. */
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

/** Plain one-line description of who a reminder notifies (the card line). */
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

export function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export type OffsetUnit = "minutes" | "hours" | "days";

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

export function getOffsetUnit(minutes: number): OffsetUnit {
  const abs = Math.abs(minutes);
  if (abs > 0 && abs % MINUTES_PER_HOUR === 0 && abs <= MAX_HOUR_OFFSET_MINUTES)
    return "hours";
  if (abs > 0 && abs % MINUTES_PER_DAY === 0) return "days";
  if (abs > 0 && abs % MINUTES_PER_HOUR === 0) return "hours";
  return "minutes";
}

export function getOffsetAmount(minutes: number, unit: OffsetUnit): number {
  return Math.abs(minutes) / offsetUnitFactor(unit);
}

/** Plain timing phrase, e.g. "24 hours before deadline" / "At deadline". */
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

export function formatValidityWindow(policy: MockReminderPolicy): string {
  const from = isoFromDate(policy.validFrom);
  if (policy.validUntil === null) {
    return `Valid since ${from} · no end date`;
  }
  const until = isoFromDate(policy.validUntil);
  return `${from} → ${until}`;
}

/**
 * The earliest future derived-rule fire time, formatted as a plain date, or
 * `null` when there is no upcoming send (every derived rule already fired or
 * is paused). Pure: callers pass `now` so the result is deterministic in
 * tests. The row maps `null` to "No upcoming sends" (D4).
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
  const fireAt = next.fireAt;
  return `${monthShortLabel(fireAt)} ${fireAt.getUTCDate()}, ${fireAt.getUTCFullYear()}`;
}
