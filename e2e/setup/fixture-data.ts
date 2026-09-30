import { shortNameFromName } from "@customreport/shared";

import {
  LEAD_1,
  REPORT_ACTIVE,
  REPORT_PUBLISHED,
} from "../../prisma/seeds/simple/seed-simple.ids.js";
import { EXTRA_REPORTS } from "../../prisma/seeds/simple/seed-simple.period.js";
import { HISTORY_REPORT_2_ID } from "../../prisma/seeds/support/seed-identifiers.js";
import { SEED_REPORTS } from "../../prisma/seeds/support/seed-periods.js";

const futureReport = EXTRA_REPORTS.find((report) => report.status === "draft");
if (!futureReport) {
  throw new Error("E2E fixture-data: missing draft future report in seed");
}

const LEAD_FULL_NAME = "Иванов Василий Петрович";

export const LEAD_FORM_FIXTURE = {
  reportId: REPORT_ACTIVE,
  previousReportId: REPORT_PUBLISHED,
  futureReportId: futureReport.id,
  leadId: LEAD_1,
  leadName: LEAD_FULL_NAME,
  leadDisplayName: shortNameFromName(LEAD_FULL_NAME),
  headName: "Кедров Антон Сергеевич",
  leadEmail: "lead1@customreport.local",
  headEmail: "head@customreport.local",
  productName: "Маркетинговый портал",
  activityName: "Поддержка и сопровождение",
  currentText:
    "Завершил рефакторинг модуля авторизации в Маркетинговом портале",
  nextText: "Запланировал ревью архитектуры с платформенной командой",
  carriedText: "Перенёс A/B тесты на новую инфраструктуру",
  carriedProductName: "CRM-Data Lake",
  explicitNextText: "E2E explicit next commitment",
  previousText: "Перенос: продолжить рефакторинг авторизации",
  singleStageProductName: "E2E single-stage product",
  singleStageName: "Development",
  ownReviewComment: "E2E own reviewer record feedback",
  privateStrings: {
    pausedReason: "E2E private co-author pause reason",
    headComment: "E2E private co-author reviewer comment",
  },
  foreignText: "PM: согласование требований к модулю портальной аналитики",
  foreignLeadName: "Сиренев Борис",
} as const;

export const OPEN_WORK_FIXTURE = {
  archiveReportId: HISTORY_REPORT_2_ID,
  paused: "E2E paused work",
  deferred: "E2E deferred work",
  continue: "E2E continue work",
  planned: "E2E planned work",
  completed: "E2E completed work",
  cancelled: "E2E cancelled work",
  automaticPaused: "E2E unscheduled work",
} as const;

export const ARCHIVED_FILL_FIXTURE = {
  reportId: SEED_REPORTS.published.id,
  weekLabel: SEED_REPORTS.published.weekLabel,
  periodStart: SEED_REPORTS.published.periodStart,
  periodEnd: SEED_REPORTS.published.periodEnd,
  sourceText: "E2E archived Fill source work",
  sourceStableId: "e2e00000-0000-4000-8000-0000000000f3",
  stageName: "Planning",
  productName: "Маркетинговый портал",
} as const;
