import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  TrafficLightStatus,
} from "@prisma/client";

import { PROD_CRM, PROD_CRM_SALES, PROD_PAYMENTS } from "./seed-simple.ids.js";

// Boris authors the Planning slice of the cross-author overlay. His own ACTIVE
// section (index 7 of LEADS) already exists; these rows are the content Vasily
// sees merged into his PROD_CRM report under the owner lock badge.
const SECTION_ID = "a0000000-0000-4000-8000-000000000407";

async function seedSalesSlice(prisma: PrismaClient): Promise<void> {
  await prisma.projectStatus.create({
    data: {
      id: "a0000000-0000-4000-8000-000000006791",
      reportSectionId: SECTION_ID,
      projectId: PROD_CRM_SALES,
      // Boris has no own seeded StageStatus rows on PROD_CRM_SALES, so this
      // row must not claim a severity — a status hue needs a visible stage
      // correlate. Green is the calm default the app itself would aggregate to.
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007001",
      reportSectionId: SECTION_ID,
      type: ItemType.next,
      projectId: PROD_CRM_SALES,
      text: "PM-обзор: подключить выгрузку sales-метрик в CRM-Sales Hub",
      tag: "analysis",
      workflowStatus: ItemWorkflowStatus.planned,
      carriedOver: false,
      stageNames: ["Planning"],
    },
  });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009001",
      reportSectionId: SECTION_ID,
      projectId: PROD_CRM_SALES,
      risk: "Sales API rate-limit на пиках нагрузки",
      impact: "Деградация дашборда для отдела продаж",
      mitigation: "PM эскалирует задачу на инфра-команду",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
}

const CRM_ITEMS = [
  {
    id: "a0000000-0000-4000-8000-000000007002",
    reportSectionId: SECTION_ID,
    type: ItemType.current,
    projectId: PROD_CRM,
    text: "PM: согласование требований к модулю портальной аналитики",
    tag: "analysis",
    workflowStatus: ItemWorkflowStatus.in_progress,
    carriedOver: false,
    stageNames: ["Planning"],
    priorityRank: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000007003",
    reportSectionId: SECTION_ID,
    type: ItemType.next,
    projectId: PROD_CRM,
    text: "Стартовать дискавери-сессию с командой дизайна",
    tag: "feature",
    workflowStatus: ItemWorkflowStatus.planned,
    carriedOver: false,
    stageNames: ["Planning"],
  },
];

async function seedCrmSlice(prisma: PrismaClient): Promise<void> {
  await prisma.item.createMany({ data: CRM_ITEMS });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009002",
      reportSectionId: SECTION_ID,
      projectId: PROD_CRM,
      risk: "Требования к аналитическому модулю не финализированы до старта разработки",
      impact: "Задержка Design-спринта на 1 неделю",
      mitigation: "PM фасилитирует воркшоп с заказчиком до пятницы",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007004",
      reportSectionId: SECTION_ID,
      productId: PROD_CRM,
      text: "Утвердить структуру аналитического API до начала разработки",
      owner: "Семёнов Борис",
      impact: "Позволяет Design-команде начать прототипирование немедленно",
      stageNames: ["Planning"],
    },
  });
}

// Boris owns NO StageAssignment on PROD_PAYMENTS, so this pair sits outside his
// stage-owned `projects` and must still render the real product name through
// the read model's name-only `referencedProjects`.
async function seedPaymentsSlice(prisma: PrismaClient): Promise<void> {
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009003",
      reportSectionId: SECTION_ID,
      projectId: PROD_PAYMENTS,
      risk: "Интеграция с платёжным шлюзом не согласована с командой Ольги",
      impact: "Мобильный чек-аут не сможет принимать платежи в релизе",
      mitigation: "Борис назначает синк с командой Платёжного шлюза",
      severity: "at-risk",
      stageNames: ["Planning"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007005",
      reportSectionId: SECTION_ID,
      productId: PROD_PAYMENTS,
      text: "Согласовать SLA платёжного API для мобильного чек-аута",
      owner: "Семёнов Борис",
      impact: "Снимает блокер интеграции до начала Dev-фазы",
      stageNames: ["Planning"],
    },
  });
}

export async function seedBorisOverlay(prisma: PrismaClient): Promise<void> {
  await seedSalesSlice(prisma);
  await seedCrmSlice(prisma);
  await seedPaymentsSlice(prisma);
}
