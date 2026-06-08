/**
 * Policy-editor form-state type + factories for the Reminders tab, extracted
 * from `reminders-tab.tsx` (R3a-4 max-lines split). Pure data construction —
 * no JSX. Shared by the tab (initial + reset state) and the PolicyForm editor.
 */

import type { AdminReminderPolicyFormInput } from "../../lib/mappers";
import type { MockReminderPolicy } from "./mock-data";
import { isoFromDate } from "./reminders-tab-format";

export type PolicyFormState = AdminReminderPolicyFormInput & {
  /** ISO `YYYY-MM-DD` of "now" when this form was first opened. */
  todayIso: string;
  /**
   * Mirrors the "forever" checkbox. When `true`, `validUntilIso` is
   * forced to `null` and the upper-bound input is hidden.
   */
  foreverChecked: boolean;
};

function todayIsoString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * UFB-048 (Phase 48-B): the timezone + audience defaults are now sourced
 * from AppSettings (the org-wide singleton) rather than hardcoded here.
 * Historical fallbacks preserved so component tests that don't pipe in
 * settings still render with the same shape they did pre-48-B.
 */
export function emptyPolicyForm(opts?: {
  timezone?: string;
  audience?: MockReminderPolicy["audience"];
}): PolicyFormState {
  const today = todayIsoString();
  return {
    kind: "deadline",
    offsetMinutes: -1440, // T-24h
    timezone: opts?.timezone ?? "Europe/Moscow",
    audience: opts?.audience ?? "lead-with-draft",
    active: true,
    validFromIso: today,
    validUntilIso: null,
    todayIso: today,
    foreverChecked: true,
  };
}

export function policyToForm(policy: MockReminderPolicy): PolicyFormState {
  return {
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
