import { type PrismaClient, ReminderAudience } from "@prisma/client";

import { DEFAULT_REPORTING_GROUP } from "../../../packages/shared/src/organization/default-reporting-group.js";
import {
  DEFAULT_REPORTING_GROUP_ID,
  FINANCE_GROUP_ID,
} from "./seed-simple.ids.js";

// Organization and AppSettings are single-row tables keyed by this literal.
const SINGLETON_ID = "singleton";

const ORGANIZATION = {
  shortName: "PEO",
  fullName: "Product Engineering & Operations",
};

const APP_SETTINGS = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  gracePeriodHours: 24,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: ReminderAudience.LEAD_WITH_DRAFT,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
};

export async function seedReportingGroups(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Creating reporting groups...");
  await prisma.reportingGroup.create({
    data: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: DEFAULT_REPORTING_GROUP.name,
      description: "Default reporting group for CustomReport demo users",
    },
  });
  // Keep the Finance leads outside the Core Development head's report scope.
  await prisma.reportingGroup.create({
    data: {
      id: FINANCE_GROUP_ID,
      name: "Finance",
      description: "Finance and HR reporting group",
    },
  });
}

export async function seedOrganizationSettings(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Creating organization + app settings...");
  await prisma.organization.upsert({
    where: { id: SINGLETON_ID },
    update: ORGANIZATION,
    create: { id: SINGLETON_ID, ...ORGANIZATION },
  });
  await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    update: APP_SETTINGS,
    create: { id: SINGLETON_ID, ...APP_SETTINGS },
  });
}
