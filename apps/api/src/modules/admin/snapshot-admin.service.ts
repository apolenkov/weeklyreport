import {
  type AdminSnapshot,
  adminSnapshotSchema,
  type AdminUser,
  adminUserSchema,
  type AppSettings,
  appSettingsSchema,
  appSettingsUpdateSchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type { AdminRepository } from "./admin-shared";

/**
 * Owns the AppSettings singleton and the snapshot read path plus the
 * user-level snapshot mutations.
 */
export class SnapshotAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /** Get application settings singleton. */
  async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  /** Update application settings (partial). */
  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const parsed = appSettingsUpdateSchema.parse(data);
    return appSettingsSchema.parse(
      await this.repository.updateSettings(parsed),
    );
  }

  async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertUser(user: AdminUser): Promise<AdminSnapshot> {
    const parsedUser = adminUserSchema.parse(user);
    this.logger.info("upserted user", { userId: parsedUser.id });
    await this.repository.upsertUser(parsedUser);
    return this.getSnapshot();
  }

  async removeUser(userId: string): Promise<AdminSnapshot> {
    await this.repository.removeUser(userId);
    return this.getSnapshot();
  }

  /**
   * Deactivate a user — sets `isActive=false`. Session revocation (the Redis
   * fast-path so an in-flight JWT is rejected immediately) is the caller's
   * job; this method only flips the durable flag.
   */
  async deactivateUser(userId: string): Promise<{ success: true }> {
    await this.repository.deactivateUser(userId);
    return { success: true };
  }

  /**
   * Re-activate a user — sets `isActive=true`. Session restoration is the
   * caller's job.
   */
  async activateUser(userId: string): Promise<{ success: true }> {
    await this.repository.activateUser(userId);
    return { success: true };
  }

  /**
   * External-integrations status bundle for the Settings → Integrations
   * sub-tab. v1 carries Telegram only. Telegram is considered «active» only
   * when both the API has `TG_BOT_TOKEN` set (the `configured` flag,
   * resolved by the caller from env) AND at least one TelegramBinding row
   * has `active=true`. Either gate failing keeps the badge muted.
   */
  async integrationsStatus(
    configured: boolean,
  ): Promise<{ telegram: { configured: boolean; bindings: number } }> {
    const bindings = await this.repository.countActiveTelegramBindings();
    return { telegram: { configured, bindings } };
  }
}
