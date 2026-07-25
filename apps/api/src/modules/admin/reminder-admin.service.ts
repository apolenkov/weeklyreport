import {
  type AdminReminderRule,
  adminReminderRuleSchema,
  type AdminSnapshot,
  adminSnapshotSchema,
  type ReminderPolicy,
  reminderPolicySchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type { AdminRepository } from "./admin-shared";

interface ReminderAdminRepository extends AdminRepository {
  reminderPolicyExists(policyId: string): Promise<boolean>;
}

export class ReminderAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: ReminderAdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  private async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertReminderRule(rule: AdminReminderRule): Promise<AdminSnapshot> {
    const parsedRule = adminReminderRuleSchema.parse(rule);
    this.logger.info("upserted reminder rule", { ruleId: parsedRule.id });
    await this.repository.upsertReminderRule(parsedRule);
    return this.getSnapshot();
  }

  async removeReminderRule(ruleId: string): Promise<AdminSnapshot> {
    await this.repository.removeReminderRule(ruleId);
    return this.getSnapshot();
  }

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
    this.logger.info("upserted reminder policy", { policyId: parsed.id });
    return reminderPolicySchema.parse(
      await this.repository.saveReminderPolicy(parsed),
    );
  }

  // Hard-delete; no soft-delete fallback.
  async removePolicy(policyId: string): Promise<{ success: true }> {
    this.logger.info("deleted reminder policy", { policyId });
    await this.repository.deleteReminderPolicy(policyId);
    return { success: true };
  }
}
