/**
 * `adminReminderRuleSchema` has no name/description. We synthesize both from
 * `kind` (+ `fireAt` for the description) so the Reminders tab has readable
 * copy instead of a raw enum value.
 */

import type { AdminReminderRule } from "@customreport/shared";

import type { MockReminder } from "./admin-types";

function reminderName(kind: AdminReminderRule["kind"]): string {
  switch (kind) {
    case "deadline":
      return "Deadline reminder";
    case "escalation":
      return "Escalation digest";
    case "follow_up":
    default:
      return "Follow-up reminder";
  }
}

// "YYYY-MM-DD HH:MM" — ISO date+time truncated to minute precision.
const ISO_DATETIME_MINUTE_LENGTH = 16;

function reminderDescription(rule: AdminReminderRule): string {
  const at = rule.fireAt
    .toISOString()
    .replace("T", " ")
    .slice(0, ISO_DATETIME_MINUTE_LENGTH);
  switch (rule.kind) {
    case "deadline":
      return `Send a reminder when the deadline is reached (fires at ${at} UTC).`;
    case "escalation":
      return `Send a T+2h escalation digest to the head with all late leads (fires at ${at} UTC).`;
    case "follow_up":
    default:
      return `Send a follow-up reminder to leads who have not submitted (fires at ${at} UTC).`;
  }
}

/**
 * Translates `admin.snapshot` reminder rules → presentation.
 *
 * The Reminder status → active mapping:
 *   apiStatus === 'active' => mock.active === true
 *   apiStatus === 'paused' => mock.active === false
 */
export function mapReminder(api: AdminReminderRule): MockReminder {
  return {
    id: api.id,
    name: reminderName(api.kind),
    description: reminderDescription(api),
    active: api.status === "active",
    kind: api.kind,
    fireAt: api.fireAt,
    timezone: api.timezone,
    version: api.version,
    reportId: api.reportId,
    policyId: api.policyId,
  };
}
