import { MINUTES_PER_DAY } from "@weeklyreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";
import type { AdminReminderPolicyFormInput } from "./admin";
import type { AdminReminderPolicyView } from "./admin-types";
import {
  presetForPolicy,
  presetPairing,
  type ReminderPreset,
} from "./reminders-tab-format";

const DEFAULT_OFFSET_DAYS_BEFORE = 1;
const DEFAULT_OFFSET_MINUTES = -(DEFAULT_OFFSET_DAYS_BEFORE * MINUTES_PER_DAY);

export type PolicyFormState = AdminReminderPolicyFormInput & {
  preset: ReminderPreset;
  // The forever control represents a null validity end date.
  foreverChecked: boolean;
};

const DEFAULT_PRESET = "deadline-leads" as const;

// Start from a valid preset; never blend org audience (produced invalid pairs).
// Only timezone comes from AppSettings.
export function emptyPolicyForm(timezone: string): PolicyFormState {
  const today = toIsoDateString(new Date());
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
    foreverChecked: true,
  };
}

export function policyToForm(policy: AdminReminderPolicyView): PolicyFormState {
  return {
    preset: presetForPolicy(policy.kind, policy.audience),
    kind: policy.kind,
    offsetMinutes: policy.offsetMinutes,
    timezone: policy.timezone,
    audience: policy.audience,
    active: policy.active,
    validFromIso: toIsoDateString(policy.validFrom),
    validUntilIso:
      policy.validUntil === null ? null : toIsoDateString(policy.validUntil),
    foreverChecked: policy.validUntil === null,
  };
}
