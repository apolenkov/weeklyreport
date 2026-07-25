import { MINUTES_PER_DAY } from "@customreport/shared";

import type { AdminReminderPolicyFormInput } from "./admin";
import type { MockReminderPolicy } from "./admin-types";
import {
  isoFromDate,
  presetForPolicy,
  presetPairing,
  type ReminderPresetChoice,
} from "./reminders-tab-format";

const ISO_DATE_LENGTH = 10;
const DEFAULT_OFFSET_DAYS_BEFORE = 1;
const DEFAULT_OFFSET_MINUTES = -(DEFAULT_OFFSET_DAYS_BEFORE * MINUTES_PER_DAY);

export type PolicyFormState = AdminReminderPolicyFormInput & {
  /**
   * The selected Reminder type. `kind`/`audience` are derived from it on
   * save for a real preset, and preserved verbatim for a "custom" row so a
   * legacy pairing is never silently coerced into a preset.
   */
  preset: ReminderPresetChoice;
  /** ISO `YYYY-MM-DD` of "now" when this form was first opened. */
  todayIso: string;
  /**
   * Mirrors the "forever" checkbox. When `true`, `validUntilIso` is forced to
   * `null` and the upper-bound input is hidden.
   */
  foreverChecked: boolean;
};

const DEFAULT_PRESET = "deadline-leads" as const;

function todayIsoString(): string {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

// Start from a valid preset; never blend org audience (produced invalid pairs).
// Only timezone comes from AppSettings.
/**
 * Empty Policy Form.
 * @param timezone - The timezone argument.
 */
export function emptyPolicyForm(timezone: string): PolicyFormState {
  const today = todayIsoString();
  const { kind, audience } = presetPairing(DEFAULT_PRESET);
  return {
    preset: DEFAULT_PRESET,
    kind,
    audience,
    offsetMinutes: DEFAULT_OFFSET_MINUTES,
    timezone,
    active: true,
    validFromIso: today,
    validUntilIso: null,
    todayIso: today,
    foreverChecked: true,
  };
}

/**
 * Policy To Form.
 * @param policy - The policy argument.
 */
export function policyToForm(policy: MockReminderPolicy): PolicyFormState {
  return {
    preset: presetForPolicy(policy.kind, policy.audience),
    kind: policy.kind,
    offsetMinutes: policy.offsetMinutes,
    timezone: policy.timezone,
    audience: policy.audience,
    active: policy.active,
    validFromIso: isoFromDate(policy.validFrom),
    validUntilIso:
      policy.validUntil === null ? null : isoFromDate(policy.validUntil),
    todayIso: todayIsoString(),
    foreverChecked: policy.validUntil === null,
  };
}
