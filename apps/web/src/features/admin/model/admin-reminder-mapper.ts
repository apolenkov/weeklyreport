import type { AdminReminderRule } from "@weeklyreport/shared";

import type { AdminReminderView } from "./admin-types";

export function mapReminder(api: AdminReminderRule): AdminReminderView {
  return {
    policyId: api.policyId,
    fireAt: api.fireAt,
    active: api.status === "active",
  };
}
