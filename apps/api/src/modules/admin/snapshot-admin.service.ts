import {
  type AdminSnapshot,
  adminSnapshotSchema,
  type AdminUser,
  adminUserSchema,
  type AppSettings,
  appSettingsSchema,
  appSettingsUpdateSchema,
  omitUndefinedProperties,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type { AdminRepository } from "./admin-shared";

export class SnapshotAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const parsed = appSettingsUpdateSchema.parse(data);
    return appSettingsSchema.parse(
      await this.repository.updateSettings(omitUndefinedProperties(parsed)),
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

  // Durable isActive only; Redis session revocation is the caller's job.
  async deactivateUser(userId: string): Promise<{ success: true }> {
    await this.repository.deactivateUser(userId);
    return { success: true };
  }

  // Durable isActive only; session restoration is the caller's job.
  async activateUser(userId: string): Promise<{ success: true }> {
    await this.repository.activateUser(userId);
    return { success: true };
  }

  // Telegram active only when TG_BOT_TOKEN is set AND at least one binding is active.
  async integrationsStatus(
    configured: boolean,
  ): Promise<{ telegram: { configured: boolean; bindings: number } }> {
    const bindings = await this.repository.countActiveTelegramBindings();
    return { telegram: { configured, bindings } };
  }
}
