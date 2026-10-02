import type { PrismaClient } from "@prisma/client";
import {
  PeriodState,
  PeriodStatus,
  ReportSectionStatus,
  ReportStatus,
} from "@prisma/client";

import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import {
  HEAD_USER_ID,
  LEAD_1_ID,
  SEED_REPORTS,
} from "../support/seed-constants.js";
import {
  endOfDayUTC,
  fridayDeadlineFor,
  isoWeekNumber,
  mondayOfWeekUTC,
  plusDaysUTC,
} from "../support/utc-period-dates.js";
import { LEAD_SLOT_OLGA } from "./seed-advanced.anchors.js";
import {
  ACTIVE_SUFFIX,
  itemId,
  PUBLISHED_SUFFIX,
} from "./seed-advanced.ids.js";
import { upsertSection } from "./seed-advanced.rows.js";

// Synthetic fixtures for UX rows that the regular dataset cannot reach
// (TASK-145.43). Every row is deterministic and idempotent like the rest of
// the advanced dataset.
//
//   LO-14 / T4: a one-day period older than the history weeks in which the
//               primary lead never submitted (draft, no submittedAt).
//   LS-04:      Olga's open draft carries one item whose stableId already
//               exists in the published period, so Fill from is locked.
export const UX_ONE_DAY_REPORT_ID = "a0000000-0000-4000-8000-000000000006";
const UX_ONE_DAY_SECTION_ID = "a0000000-0000-4000-8000-000000004061";
const WEEKS_BEFORE_ACTIVE = 5;
const DAYS_PER_WEEK = 7;
const FIRST_ITEM_SEQ = 1;

export interface UxFixtureResult {
  readonly reports: number;
  readonly sections: number;
}

async function seedOneDayPeriod(prisma: PrismaClient): Promise<void> {
  const monday = plusDaysUTC(
    mondayOfWeekUTC(new Date(SEED_REPORTS.active.periodStart)),
    -WEEKS_BEFORE_ACTIVE * DAYS_PER_WEEK,
  );
  const periodEnd = endOfDayUTC(monday);
  const fields = {
    periodStart: monday,
    periodEnd,
    deadline: fridayDeadlineFor(monday),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    periodState: PeriodState.published,
    archived: false,
    weekLabel: `Week ${isoWeekNumber(monday)}`,
    publishedAt: periodEnd,
    publishedById: HEAD_USER_ID,
    publishedSnapshot: provisionalPublishedSnapshot({
      reportId: UX_ONE_DAY_REPORT_ID,
      periodStart: monday,
      periodEnd,
      deadline: fridayDeadlineFor(monday),
      publishedAt: periodEnd,
      publishedById: HEAD_USER_ID,
      publishedByName: "Елена Р.",
    }),
  };
  await prisma.report.upsert({
    where: { id: UX_ONE_DAY_REPORT_ID },
    update: fields,
    create: { id: UX_ONE_DAY_REPORT_ID, ...fields },
  });
  await upsertSection(prisma, {
    id: UX_ONE_DAY_SECTION_ID,
    reportId: UX_ONE_DAY_REPORT_ID,
    authorId: LEAD_1_ID,
    status: ReportSectionStatus.draft,
    submittedAt: null,
  });
}

async function seedPublishedLineageOverlap(
  prisma: PrismaClient,
): Promise<void> {
  const publishedStableId = itemId(
    PUBLISHED_SUFFIX,
    LEAD_SLOT_OLGA,
    FIRST_ITEM_SEQ,
  );
  await prisma.item.update({
    where: { id: itemId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA, FIRST_ITEM_SEQ) },
    data: { stableId: publishedStableId },
  });
}

/** Run after the active, published and history seeds, before the snapshot pass. */
export async function seedUxFixtures(
  prisma: PrismaClient,
): Promise<UxFixtureResult> {
  await seedOneDayPeriod(prisma);
  await seedPublishedLineageOverlap(prisma);
  return { reports: 1, sections: 1 };
}
