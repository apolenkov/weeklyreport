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

// The canonical init migration provisions the singleton; a READ that encounters
// a missing row is a data-integrity failure, not a signal to materialize defaults.
export async function getSettings(prisma: PrismaService): Promise<AppSettings> {
  const row = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!row) {
    throw new Error(
      "AppSettings singleton row 'singleton' is missing — apply the canonical init migration or restore the row.",
    );
  }

  return rowToAppSettings(row);
}

// A partial update must touch only the columns the caller actually sent, so
// undefined entries are dropped rather than written as nulls.
function definedOnly(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

// Enumerated explicitly (never a blind spread of `data`) so an unknown key on
// the input can never reach Prisma. Enum translate mirrors `rowToAppSettings`.
function appSettingsToRow(data: Partial<AppSettings>): Record<string, unknown> {
  return definedOnly({
    autoCreatePeriods: data.autoCreatePeriods,
    defaultDeadlineDays: data.defaultDeadlineDays,
    periodLengthDays: data.periodLengthDays,
    workingDays:
      data.workingDays === undefined
        ? undefined
        : workingDaysToPrisma[data.workingDays],
    gracePeriodHours: data.gracePeriodHours,
    defaultTimezone: data.defaultTimezone,
    defaultReminderAudience:
      data.defaultReminderAudience === undefined
        ? undefined
        : audienceToPrisma[data.defaultReminderAudience],
    notificationFromEmail: data.notificationFromEmail,
    allowLateSubmissions: data.allowLateSubmissions,
    autoPublishAfterDeadline: data.autoPublishAfterDeadline,
    autoArchiveWeeksAfterPublish: data.autoArchiveWeeksAfterPublish,
    deadlineTime: data.deadlineTime,
    allowReopenAfterPublish: data.allowReopenAfterPublish,
    reopenWindowHours: data.reopenWindowHours,
    unifiedActivityView: data.unifiedActivityView,
  });
}

export async function updateSettings(
  prisma: PrismaService,
  data: Partial<AppSettings>,
): Promise<AppSettings> {
  const dbData = appSettingsToRow(data);

  // The canonical migration owns singleton creation. A partial update must
  // fail if that invariant is broken instead of manufacturing a row from DB
  // defaults and the caller's incomplete patch.
  const row = await prisma.appSettings.update({
    where: { id: "singleton" },
    data: dbData,
  });

  return rowToAppSettings(row);
}
