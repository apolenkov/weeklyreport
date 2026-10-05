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

import type { AppLogger } from "../../lib/logger";
import { AdminSelfLockoutError } from "./admin-errors.js";
import type { AdminRepository } from "./admin-shared";

const SELF_LOCKOUT_MESSAGE =
  "You cannot deactivate, delete, or remove the admin role from your own account. Ask another administrator.";

function assertNotSelf(userId: string, actorId: string): void {
  if (userId === actorId) throw new AdminSelfLockoutError(SELF_LOCKOUT_MESSAGE);
}

export class SnapshotAdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly logger: AppLogger,
  ) {}

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

  async upsertUser(user: AdminUser, actorId: string): Promise<AdminSnapshot> {
    const parsedUser = adminUserSchema.parse(user);
    if (parsedUser.id === actorId && parsedUser.role !== "admin") {
      throw new AdminSelfLockoutError(SELF_LOCKOUT_MESSAGE);
    }
    await this.repository.upsertUser(parsedUser);
    this.logger.info("upserted user", { userId: parsedUser.id });
    return this.getSnapshot();
  }

  async removeUser(userId: string, actorId: string): Promise<AdminSnapshot> {
    assertNotSelf(userId, actorId);
    await this.repository.removeUser(userId);
    return this.getSnapshot();
  }

  // Durable isActive only; Redis session revocation is the caller's job.
  async deactivateUser(
    userId: string,
    actorId: string,
  ): Promise<{ success: true }> {
    assertNotSelf(userId, actorId);
    await this.repository.deactivateUser(userId);
    return { success: true };
  }

  // Durable isActive only; session restoration is the caller's job.
  async activateUser(userId: string): Promise<{ success: true }> {
    await this.repository.activateUser(userId);
    return { success: true };
  }
}
