import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@weeklyreport/shared";

import type { AppLogger } from "../../lib/logger";
import type { AdminRepository } from "./admin-shared";

interface ReminderAdminRepository extends AdminRepository {
  readonly reminderPolicyExists: (policyId: string) => Promise<boolean>;
}

export class ReminderAdminService {
  constructor(
    private readonly repository: ReminderAdminRepository,
    private readonly logger: AppLogger,
  ) {}

  async listPolicies(): Promise<ReminderPolicy[]> {
    const rows = await this.repository.listReminderPolicies();
    return rows.map((row) => reminderPolicySchema.parse(row));
  }

  // create vs update for admin.policy.save audit / SIEM split.
  async policyExists(policyId: string): Promise<boolean> {
    return this.repository.reminderPolicyExists(policyId);
  }

  async savePolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    const parsed = reminderPolicySchema.parse(policy);
    const savedPolicy = reminderPolicySchema.parse(
      await this.repository.saveReminderPolicy(parsed),
    );
    this.logger.info("upserted reminder policy", { policyId: parsed.id });
    return savedPolicy;
  }

  // Hard-delete; no soft-delete fallback.
  async removePolicy(policyId: string): Promise<{ success: true }> {
    await this.repository.deleteReminderPolicy(policyId);
    this.logger.info("deleted reminder policy", { policyId });
    return { success: true };
  }
}
