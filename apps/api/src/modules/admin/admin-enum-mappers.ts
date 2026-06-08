import type { ReminderAudience, WorkingDays } from "@customreport/shared";
import type {
  ReminderAudience as PrismaReminderAudience,
  WorkingDays as PrismaWorkingDays,
} from "@prisma/client";

/**
 * Wire format ↔ Prisma enum mappers, extracted from
 * `admin.prisma-repository.ts` (R3a-4 max-lines split) so the per-domain
 * query modules (settings / reminder-policy / snapshot) share one boundary.
 *
 * UFB-036 (Phase 44-02): `ReminderAudience`. The Prisma model uses
 * screaming-snake (`LEAD_WITH_DRAFT | HEAD_OF_LATE`); the wire/zod contract
 * uses lowercase-hyphen (`lead-with-draft | head-of-late`).
 */
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

/**
 * UFB-048 (Phase 48-B): wire ↔ Prisma translators for the `WorkingDays`
 * enum. Mirrors the audience mappers so the DB convention
 * (`MON_FRI | MON_SAT | MON_SUN`) does not leak past this boundary into
 * shared schemas or the React UI.
 */
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
