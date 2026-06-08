/**
 * Pure display helpers + option constants for the Reminders tab, extracted from
 * `reminders-tab.tsx` (R3a-4 max-lines split). No JSX, no React state — safe to
 * import from both the tab and its sub-components.
 */

import type { MockReminderPolicy } from "./mock-data";

export const KIND_OPTIONS: readonly {
  value: MockReminderPolicy["kind"];
  label: string;
}[] = [
  { value: "deadline", label: "Deadline reminder" },
  { value: "follow_up", label: "Follow-up reminder" },
  { value: "escalation", label: "Escalation digest" },
];

export const AUDIENCE_OPTIONS: readonly {
  value: MockReminderPolicy["audience"];
  label: string;
}[] = [
  { value: "lead-with-draft", label: "Leads with draft" },
  { value: "head-of-late", label: "Head of late leads" },
];

export function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format the wall-clock offset like "T-24h" / "T+2h" / "T-15m" so admins
 * can sanity-check offsetMinutes at a glance. We avoid Intl-RelativeTimeFormat
 * here because the canonical "T-24h" form is the one used in the spec docs.
 */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "T+0";
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  if (abs % 60 === 0) {
    return `T${sign}${abs / 60}h`;
  }
  return `T${sign}${abs}m`;
}

export type OffsetUnit = "minutes" | "hours" | "days";

export function offsetUnitFactor(unit: OffsetUnit): number {
  switch (unit) {
    case "minutes":
      return 1;
    case "hours":
      return 60;
    case "days":
      return 1440;
  }
}

export function getOffsetUnit(minutes: number): OffsetUnit {
  const abs = Math.abs(minutes);
  if (abs > 0 && abs % 60 === 0 && abs <= 48 * 60) return "hours";
  if (abs > 0 && abs % 1440 === 0) return "days";
  if (abs > 0 && abs % 60 === 0) return "hours";
  return "minutes";
}

export function getOffsetAmount(minutes: number, unit: OffsetUnit): number {
  return Math.abs(minutes) / offsetUnitFactor(unit);
}

function pluralize(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

export function formatPolicyTiming(policy: MockReminderPolicy): string {
  const minutes = policy.offsetMinutes;
  if (minutes === 0) return "At deadline";

  const abs = Math.abs(minutes);
  const direction = minutes < 0 ? "before" : "after";

  if (abs % 60 === 0 && abs <= 48 * 60) {
    const hours = abs / 60;
    return `${hours} ${pluralize(hours, "hour", "hours")} ${direction} deadline`;
  }

  if (abs % 1440 === 0) {
    const days = abs / 1440;
    return `${days} ${pluralize(days, "day", "days")} ${direction} deadline`;
  }

  return `${abs} ${pluralize(abs, "minute", "minutes")} ${direction} deadline`;
}

export function formatPolicyAudience(
  audience: MockReminderPolicy["audience"],
): string {
  switch (audience) {
    case "lead-with-draft":
      return "Leads with drafts";
    case "head-of-late":
      return "Head of late leads";
  }
}

export function formatGeneratedRulesSummary(count: number): string {
  if (count === 0) return "No scheduled periods yet";
  if (count === 1) return "1 scheduled period";
  return `${count} scheduled periods`;
}

export function formatValidityWindow(policy: MockReminderPolicy): string {
  const from = isoFromDate(policy.validFrom);
  if (policy.validUntil === null) {
    return `Valid since ${from} · no end date`;
  }
  const until = isoFromDate(policy.validUntil);
  return `${from} → ${until}`;
}

export function formatPolicyHeadline(policy: MockReminderPolicy): string {
  return `${policy.kind} · ${formatOffset(policy.offsetMinutes)} · ${policy.audience}`;
}
