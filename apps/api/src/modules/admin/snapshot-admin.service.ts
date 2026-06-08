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
import { type AdminRepository, sortByName } from "./admin-shared";

/**
 * Owns the AppSettings singleton and the snapshot read path plus the
 * user-level snapshot mutations. Extracted verbatim from `AdminService`
 * (code-quality-modernization, Wave 3); behavior unchanged.
 */
export class SnapshotAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /** API-11: Get application settings singleton. */
  async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  /** API-11: Update application settings (partial). */
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
    const snapshot = await this.getSnapshot();
    const nextUsers = sortByName(
      snapshot.users.some((row) => row.id === parsedUser.id)
        ? snapshot.users.map((row) =>
            row.id === parsedUser.id ? parsedUser : row,
          )
        : [...snapshot.users, parsedUser],
    );

    this.logger.info("upserted user", { userId: parsedUser.id });
    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }),
    );
  }

  async removeUser(userId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextUsers = snapshot.users.filter((row) => row.id !== userId);

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }),
    );
  }
}
