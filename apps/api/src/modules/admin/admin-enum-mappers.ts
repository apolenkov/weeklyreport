import type {
  ReminderAudience as PrismaReminderAudience,
  WorkingDays as PrismaWorkingDays,
} from "@prisma/client";
import type { ReminderAudience, WorkingDays } from "@weeklyreport/shared";

// Prisma screaming-snake ↔ wire lowercase-hyphen for ReminderAudience.
export const audienceFromPrisma: Record<
  PrismaReminderAudience,
  ReminderAudience
> = {
  LEAD_WITH_DRAFT: "lead-with-draft",
  HEAD_OF_LATE: "head-of-late",
};
export const audienceToPrisma: Record<
  ReminderAudience,
  PrismaReminderAudience
> = {
  "lead-with-draft": "LEAD_WITH_DRAFT",
  "head-of-late": "HEAD_OF_LATE",
};

// Prisma WorkingDays (MON_FRI…) ↔ wire mon-fri; keep DB enum out of shared/UI.
export const workingDaysFromPrisma: Record<PrismaWorkingDays, WorkingDays> = {
  MON_FRI: "mon-fri",
  MON_SAT: "mon-sat",
  MON_SUN: "mon-sun",
};
export const workingDaysToPrisma: Record<WorkingDays, PrismaWorkingDays> = {
  "mon-fri": "MON_FRI",
  "mon-sat": "MON_SAT",
  "mon-sun": "MON_SUN",
};
