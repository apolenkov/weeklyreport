import { type PrismaClient, TrafficLightStatus } from "@prisma/client";

import {
  DEFAULT_REPORTING_GROUP_ID,
  LEAD_1,
  LEAD_DMITRY,
  LEAD_IGOR,
  LEAD_MARIA,
  PROD_CLOUD,
  PROD_CRM,
  PROD_DEVOPS,
  PROD_MOBILE,
} from "./seed-simple.ids.js";

interface ActivitySeed {
  productId: string;
  groupId: string;
  leadId: string;
  sectionId: string;
  activities: readonly {
    name: string;
    status: TrafficLightStatus;
    note?: string;
  }[];
}

// Stage-less Project Activities beside the products, so the assembled report's
// "Project Activities" band renders out of the box. Both SUBMITTED sections
// (402, 404) get a full green/yellow/red spread so the band stays meaningful
// under the submitted-only filter.
const ACTIVITY_SEEDS: readonly ActivitySeed[] = [
  {
    productId: PROD_CRM,
    groupId: DEFAULT_REPORTING_GROUP_ID,
    leadId: LEAD_1,
    sectionId: "a0000000-0000-4000-8000-000000000401",
    activities: [
      { name: "Поддержка и сопровождение", status: TrafficLightStatus.green },
      {
        name: "Технический долг и рефакторинг",
        status: TrafficLightStatus.yellow,
      },
      {
        name: "Исследование новых интеграций",
        status: TrafficLightStatus.red,
        note: "Партнёр задерживает доступ к API",
      },
    ],
  },
  {
    productId: PROD_MOBILE,
    groupId: DEFAULT_REPORTING_GROUP_ID,
    leadId: LEAD_MARIA,
    sectionId: "a0000000-0000-4000-8000-000000000402",
    activities: [
      { name: "Дежурство по инцидентам", status: TrafficLightStatus.green },
      {
        name: "Миграция на новый API-шлюз",
        status: TrafficLightStatus.red,
        note: "Ждём подтверждения от инфраструктурной команды",
      },
      {
        name: "Нагрузочное тестирование",
        status: TrafficLightStatus.yellow,
      },
    ],
  },
  {
    productId: PROD_CLOUD,
    groupId: DEFAULT_REPORTING_GROUP_ID,
    leadId: LEAD_IGOR,
    sectionId: "a0000000-0000-4000-8000-000000000403",
    activities: [
      { name: "Мониторинг и алертинг", status: TrafficLightStatus.green },
      {
        name: "Оптимизация затрат на облако",
        status: TrafficLightStatus.yellow,
      },
    ],
  },
  {
    productId: PROD_DEVOPS,
    groupId: DEFAULT_REPORTING_GROUP_ID,
    leadId: LEAD_DMITRY,
    sectionId: "a0000000-0000-4000-8000-000000000404",
    activities: [
      { name: "Сопровождение CI/CD", status: TrafficLightStatus.green },
      {
        name: "Ротация секретов и аудит доступа",
        status: TrafficLightStatus.yellow,
      },
      {
        name: "Обновление базового образа",
        status: TrafficLightStatus.red,
        note: "Уязвимость в текущем образе, нужен срочный патч",
      },
    ],
  },
];

// Deterministic ids (idempotent re-run): 00000000c{a|b|c|d}{product}{activity}
// — a=activity, b=lead-link, c=status, d=product-link; the position-9 'c' slot
// is unused by other seed anchors. product/activity indices stay single hex
// digits.
const ACTIVITY_ROWS = ACTIVITY_SEEDS.flatMap((seed, pIdx) =>
  seed.activities.map((activity, aIdx) => {
    const suffix = `${pIdx}${aIdx}`;
    return {
      activityId: `a0000000-0000-4000-8000-00000000ca${suffix}`,
      leadLinkId: `a0000000-0000-4000-8000-00000000cb${suffix}`,
      statusId: `a0000000-0000-4000-8000-00000000cc${suffix}`,
      productLinkId: `a0000000-0000-4000-8000-00000000cd${suffix}`,
      productId: seed.productId,
      groupId: seed.groupId,
      leadId: seed.leadId,
      sectionId: seed.sectionId,
      name: activity.name,
      status: activity.status,
      note: activity.note ?? null,
    };
  }),
);

// Lead attachment is M:M; the product label link (M:N) is what an activity
// reports against, shown as the linkedProducts chip on every surface.
// UNIQUE(activityId, productId) holds since each demo activity links one product.
async function seedActivityLinks(prisma: PrismaClient): Promise<void> {
  await prisma.projectActivityLead.createMany({
    data: ACTIVITY_ROWS.map((row) => ({
      id: row.leadLinkId,
      activityId: row.activityId,
      leadId: row.leadId,
    })),
  });
  await prisma.projectActivityProduct.createMany({
    data: ACTIVITY_ROWS.map((row) => ({
      id: row.productLinkId,
      activityId: row.activityId,
      productId: row.productId,
    })),
  });
}

// One ActivityStatus per attached activity on the lead's own section;
// UNIQUE(reportSectionId, activityId) holds since each activity binds to
// exactly one product → one section.
async function seedActivityStatuses(prisma: PrismaClient): Promise<void> {
  await prisma.activityStatus.createMany({
    data: ACTIVITY_ROWS.map((row) => ({
      id: row.statusId,
      reportSectionId: row.sectionId,
      activityId: row.activityId,
      status: row.status,
      note: row.note,
    })),
  });
}

export async function seedProjectActivities(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Creating project activities + weekly statuses...");
  await prisma.projectActivity.createMany({
    data: ACTIVITY_ROWS.map((row) => ({
      id: row.activityId,
      name: row.name,
      groupId: row.groupId,
    })),
  });
  await seedActivityLinks(prisma);
  await seedActivityStatuses(prisma);
}
