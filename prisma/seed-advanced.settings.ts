import type { PrismaClient } from "@prisma/client";
import { ReminderAudience } from "@prisma/client";

import { MOSCOW_TIMEZONE } from "./seed-advanced.period.js";

const SINGLETON_ID = "singleton";

const DEFAULT_DEADLINE_DAYS = 5;
const PERIOD_LENGTH_DAYS = 7;
const GRACE_PERIOD_HOURS = 24;
const REOPEN_WINDOW_HOURS = 72;
const NO_AUTO_ARCHIVE = 0;

const APP_SETTINGS = {
  autoCreatePeriods: false,
  defaultDeadlineDays: DEFAULT_DEADLINE_DAYS,
  periodLengthDays: PERIOD_LENGTH_DAYS,
  gracePeriodHours: GRACE_PERIOD_HOURS,
  defaultTimezone: MOSCOW_TIMEZONE,
  defaultReminderAudience: ReminderAudience.LEAD_WITH_DRAFT,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: NO_AUTO_ARCHIVE,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: REOPEN_WINDOW_HOURS,
};

// Brand identity is owned by the Organization singleton, not by AppSettings.
const ORGANIZATION = {
  shortName: "Demo",
  fullName: "Example Software Department",
};

/**
 * Restores the two singleton rows. The init migration seeds Organization with
 * ON CONFLICT DO NOTHING, so this upsert is what re-applies the canonical
 * identity when `db seed` runs over an already-migrated database.
 */
export async function seedSingletons(prisma: PrismaClient): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    update: APP_SETTINGS,
    create: { id: SINGLETON_ID, ...APP_SETTINGS },
  });
  await prisma.organization.upsert({
    where: { id: SINGLETON_ID },
    update: ORGANIZATION,
    create: { id: SINGLETON_ID, ...ORGANIZATION },
  });
}
