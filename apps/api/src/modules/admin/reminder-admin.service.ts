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

/**
 * Owns reminder rules (snapshot-level) and the ReminderPolicy CRUD
 * surface. Extracted verbatim from `AdminService`
 * (code-quality-modernization, Wave 3); behavior unchanged.
 */
export class ReminderAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
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

  // -----------------------------------------------------------------
  // UFB-036 (Phase 44-02): ReminderPolicy surface
  // -----------------------------------------------------------------

  /**
   * List all reminder policies (active and archived). Audit-log helper
   * (`auditLogger.policySave`) is wired in 44-05; this read path stays
   * silent.
   */
  async listPolicies(): Promise<ReminderPolicy[]> {
    if (!this.repository.listReminderPolicies) {
      return [];
    }
    const rows = await this.repository.listReminderPolicies();
    return rows.map((row) => reminderPolicySchema.parse(row));
  }

  /**
   * UFB-036 (Phase 44-05): existence check used by the tRPC router to
   * decide whether the upcoming `savePolicy` call is a create or an
   * update — feeds the `admin.policy.save` audit event so SIEM rules
   * and dashboards can split the two cases without diffing payloads.
   * Returns `false` (not an exception) when the policy surface is not
   * implemented on the repository, so router-level audit emission stays
   * resilient against in-memory test repos.
   */
  async policyExists(policyId: string): Promise<boolean> {
    if (!this.repository.listReminderPolicies) return false;
    const rows = await this.repository.listReminderPolicies();
    return rows.some((row) => row.id === policyId);
  }

  /**
   * Upsert a reminder policy by id. Input is zod-validated so the
   * audience enum (`lead-with-draft | head-of-late`) and kind enum
   * (`deadline | follow_up | escalation`) cannot drift to invalid wire
   * values from a malicious admin client.
   */
  async savePolicy(policy: ReminderPolicy): Promise<ReminderPolicy> {
    const parsed = reminderPolicySchema.parse(policy);
    if (!this.repository.saveReminderPolicy) {
      throw new Error(
        "AdminRepository.saveReminderPolicy is not implemented for this repository.",
      );
    }
    this.logger.info("upserted reminder policy", { policyId: parsed.id });
    return reminderPolicySchema.parse(
      await this.repository.saveReminderPolicy(parsed),
    );
  }

  /**
   * Permanently delete a reminder policy and its derived rules. The
   * repository hard-deletes the rules (executions cascade) then the policy;
   * there is no soft-delete fallback (D9).
   */
  async removePolicy(policyId: string): Promise<{ success: true }> {
    if (!this.repository.deleteReminderPolicy) {
      throw new Error(
        "AdminRepository.deleteReminderPolicy is not implemented for this repository.",
      );
    }
    this.logger.info("deleted reminder policy", { policyId });
    await this.repository.deleteReminderPolicy(policyId);
    return { success: true };
  }
}
