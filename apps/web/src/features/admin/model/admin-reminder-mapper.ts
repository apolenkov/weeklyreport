import type { AdminReminderRule } from "@customreport/shared";

import type { AdminReminderView } from "./admin-types";

export function mapReminder(api: AdminReminderRule): AdminReminderView {
  return {
    policyId: api.policyId,
    fireAt: api.fireAt,
    active: api.status === "active",
  };
}
