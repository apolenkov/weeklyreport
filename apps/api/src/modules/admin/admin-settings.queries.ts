import { type AppSettings, appSettingsSchema } from "@customreport/shared";
import type {
  ReminderAudience as PrismaReminderAudience,
  WorkingDays as PrismaWorkingDays,
} from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  audienceFromPrisma,
  audienceToPrisma,
  workingDaysFromPrisma,
  workingDaysToPrisma,
} from "./admin-enum-mappers";

// Enum translate at this boundary so callers see only lowercase-hyphen.
function rowToAppSettings(row: {
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number;
  periodLengthDays: number;
  workingDays: PrismaWorkingDays;
  gracePeriodHours: number;
  defaultTimezone: string;
  defaultReminderAudience: PrismaReminderAudience;
  notificationFromEmail: string | null;
  allowLateSubmissions: boolean;
  autoPublishAfterDeadline: boolean;
  autoArchiveWeeksAfterPublish: number;
  deadlineTime: string;
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
  unifiedActivityView: boolean;
}): AppSettings {
  // `departmentName` does not flow through this mapper. Brand identity
  // lives on the `Organization` singleton (Identity tab in Settings) and
  // is exposed via `OrganizationService` / `auth.me.organization`.
  return appSettingsSchema.parse({
    autoCreatePeriods: row.autoCreatePeriods,
    defaultDeadlineDays: row.defaultDeadlineDays,
    periodLengthDays: row.periodLengthDays,
    workingDays: workingDaysFromPrisma[row.workingDays],
    gracePeriodHours: row.gracePeriodHours,
    defaultTimezone: row.defaultTimezone,
    defaultReminderAudience: audienceFromPrisma[row.defaultReminderAudience],
    notificationFromEmail: row.notificationFromEmail,
    allowLateSubmissions: row.allowLateSubmissions,
    autoPublishAfterDeadline: row.autoPublishAfterDeadline,
    autoArchiveWeeksAfterPublish: row.autoArchiveWeeksAfterPublish,
    deadlineTime: row.deadlineTime,
    allowReopenAfterPublish: row.allowReopenAfterPublish,
    reopenWindowHours: row.reopenWindowHours,
    unifiedActivityView: row.unifiedActivityView,
  });
}

export async function getSettings(prisma: PrismaService): Promise<AppSettings> {
  const row = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return rowToAppSettings(row);
}

export async function countActiveTelegramBindings(
  prisma: PrismaService,
): Promise<number> {
  return prisma.telegramBinding.count({ where: { active: true } });
}

export async function updateSettings(
  prisma: PrismaService,
  data: Partial<AppSettings>,
): Promise<AppSettings> {
  const dbData: Record<string, unknown> = {};
  if (data.autoCreatePeriods !== undefined)
    dbData.autoCreatePeriods = data.autoCreatePeriods;
  if (data.defaultDeadlineDays !== undefined)
    dbData.defaultDeadlineDays = data.defaultDeadlineDays;
  if (data.periodLengthDays !== undefined)
    dbData.periodLengthDays = data.periodLengthDays;
  if (data.workingDays !== undefined)
    dbData.workingDays = workingDaysToPrisma[data.workingDays];
  if (data.gracePeriodHours !== undefined)
    dbData.gracePeriodHours = data.gracePeriodHours;
  if (data.defaultTimezone !== undefined)
    dbData.defaultTimezone = data.defaultTimezone;
  if (data.defaultReminderAudience !== undefined)
    dbData.defaultReminderAudience =
      audienceToPrisma[data.defaultReminderAudience];
  if (data.notificationFromEmail !== undefined)
    dbData.notificationFromEmail = data.notificationFromEmail;
  if (data.allowLateSubmissions !== undefined)
    dbData.allowLateSubmissions = data.allowLateSubmissions;
  if (data.autoPublishAfterDeadline !== undefined)
    dbData.autoPublishAfterDeadline = data.autoPublishAfterDeadline;
  if (data.autoArchiveWeeksAfterPublish !== undefined)
    dbData.autoArchiveWeeksAfterPublish = data.autoArchiveWeeksAfterPublish;
  if (data.deadlineTime !== undefined) dbData.deadlineTime = data.deadlineTime;
  if (data.allowReopenAfterPublish !== undefined)
    dbData.allowReopenAfterPublish = data.allowReopenAfterPublish;
  if (data.reopenWindowHours !== undefined)
    dbData.reopenWindowHours = data.reopenWindowHours;
  if (data.unifiedActivityView !== undefined)
    dbData.unifiedActivityView = data.unifiedActivityView;

  const row = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      ...dbData,
    },
    update: dbData,
  });

  return rowToAppSettings(row);
}
