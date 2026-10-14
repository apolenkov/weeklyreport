import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@weeklyreport/shared";

import type { AppLogger } from "../../lib/logger";
import type { AdminRepository } from "./admin-shared";

export class ReminderAdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly logger: AppLogger,
  ) {}

  async listPolicies(): Promise<ReminderPolicy[]> {
    const rows = await this.repository.listReminderPolicies();
    return rows.map((row) => reminderPolicySchema.parse(row));
  }

  async savePolicy(
    policy: ReminderPolicy,
  ): ReturnType<AdminRepository["saveReminderPolicy"]> {
    const parsed = reminderPolicySchema.parse(policy);
    const saved = await this.repository.saveReminderPolicy(parsed);
    const savedPolicy = reminderPolicySchema.parse(saved.policy);
    this.logger.info("upserted reminder policy", { policyId: parsed.id });
    return { policy: savedPolicy, created: saved.created };
  }

  // Hard-delete; no soft-delete fallback.
  async removePolicy(policyId: string): Promise<{ success: true }> {
    await this.repository.deleteReminderPolicy(policyId);
    this.logger.info("deleted reminder policy", { policyId });
    return { success: true };
  }
}
