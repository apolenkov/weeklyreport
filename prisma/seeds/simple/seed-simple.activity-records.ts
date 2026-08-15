import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  ACTIVITY_ONLY_ID,
  ACTIVITY_ONLY_LEAD_LINK_ID,
  ACTIVITY_ONLY_PRODUCT_LINK_ID,
  ACTIVITY_ONLY_SECTION_ID,
  ACTIVITY_ONLY_STATUS_ID,
  DEFAULT_REPORTING_GROUP_ID,
  LEAD_ACTIVITY_ONLY,
  PROD_CRM,
  REPORT_ACTIVE,
} from "./seed-simple.ids.js";
import {
  ACTIVE_MONDAY,
  plusDaysUTC,
  SUBMIT_DAY_OFFSET,
} from "./seed-simple.period.js";

// Maria's first activity ("Дежурство по инцидентам") already carries a lead
// link, a status and a product label; these records make it render POPULATED
// on the lead form and the head report rather than as a bare status strip.
const POPULATED_ACTIVITY_ID = "a0000000-0000-4000-8000-00000000ca10";
const POPULATED_ACTIVITY_SECTION_ID = "a0000000-0000-4000-8000-000000000402";

// XOR parent shape: the product FK is null, `activityId` is set, and
// `stageNames` is [] because an activity carries no SDLC stage.
export async function seedActivityParentedRecords(
  prisma: PrismaClient,
): Promise<void> {
  console.log(
    "[seed-simple] Creating activity-parented item/risk/decision (populated activity)...",
  );
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ac10",
      stableId: "a0000000-0000-4000-8000-00000000ac10",
      reportSectionId: POPULATED_ACTIVITY_SECTION_ID,
      type: ItemType.current,
      projectId: null,
      activityId: POPULATED_ACTIVITY_ID,
      text: "Разобрали 6 инцидентов дежурства, ускорили типовой ответ вдвое",
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.in_progress,
      carriedOver: false,
      stageNames: [],
    },
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ad10",
      stableId: "a0000000-0000-4000-8000-00000000ad10",
      reportSectionId: POPULATED_ACTIVITY_SECTION_ID,
      projectId: null,
      activityId: POPULATED_ACTIVITY_ID,
      risk: "Пиковая нагрузка на дежурную смену на праздничной неделе",
      impact: "Рост времени реакции на инциденты сверх SLA",
      mitigation: "Усилили дежурную смену и подготовили runbook эскалации",
      severity: "at-risk",
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ae10",
      stableId: "a0000000-0000-4000-8000-00000000ae10",
      reportSectionId: POPULATED_ACTIVITY_SECTION_ID,
      productId: null,
      activityId: POPULATED_ACTIVITY_ID,
      text: "Решение: закрепить второго дежурного на праздничную неделю",
      owner: "Кузнецова Мария Андреевна",
      impact: "Держит время реакции по инцидентам в рамках SLA",
      stageNames: [],
    },
  });
}

async function seedActivityOnlyFixture(prisma: PrismaClient): Promise<void> {
  await prisma.projectActivity.create({
    data: {
      id: ACTIVITY_ONLY_ID,
      name: "Кросс-командная поддержка релизов",
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });
  await prisma.projectActivityLead.create({
    data: {
      id: ACTIVITY_ONLY_LEAD_LINK_ID,
      activityId: ACTIVITY_ONLY_ID,
      leadId: LEAD_ACTIVITY_ONLY,
    },
  });
  await prisma.projectActivityProduct.create({
    data: {
      id: ACTIVITY_ONLY_PRODUCT_LINK_ID,
      activityId: ACTIVITY_ONLY_ID,
      productId: PROD_CRM,
    },
  });
  await prisma.reportSection.create({
    data: {
      id: ACTIVITY_ONLY_SECTION_ID,
      reportId: REPORT_ACTIVE,
      authorId: LEAD_ACTIVITY_ONLY,
      status: ReportSectionStatus.submitted,
      submittedAt: plusDaysUTC(ACTIVE_MONDAY, SUBMIT_DAY_OFFSET),
    },
  });
  await prisma.activityStatus.create({
    data: {
      id: ACTIVITY_ONLY_STATUS_ID,
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      activityId: ACTIVITY_ONLY_ID,
      status: TrafficLightStatus.green,
      note: "Поддержали 3 релиза без простоя",
    },
  });
}

async function seedActivityOnlyRecords(prisma: PrismaClient): Promise<void> {
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000ace0",
      stableId: "a0000000-0000-4000-8000-00000000ace0",
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      type: ItemType.current,
      projectId: null,
      activityId: ACTIVITY_ONLY_ID,
      text: "Сопроводили 3 релиза смежных команд без простоя прод-среды",
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.done,
      carriedOver: false,
      stageNames: [],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000aee0",
      stableId: "a0000000-0000-4000-8000-00000000aee0",
      reportSectionId: ACTIVITY_ONLY_SECTION_ID,
      productId: null,
      activityId: ACTIVITY_ONLY_ID,
      text: "Решение: ввести общий чек-лист готовности релиза для смежных команд",
      owner: "Фомин Роман Аркадьевич",
      impact: "Снижает число откатов релизов на стыке команд",
      stageNames: [],
    },
  });
}

// The activity-only lead owns no product, so his ACTIVE section carries
// activity content only — this exercises the activity-only-submit relaxation
// end to end instead of leaving it dead code.
export async function seedActivityOnlyLead(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Creating activity-only lead + section...");
  await seedActivityOnlyFixture(prisma);
  await seedActivityOnlyRecords(prisma);
}
