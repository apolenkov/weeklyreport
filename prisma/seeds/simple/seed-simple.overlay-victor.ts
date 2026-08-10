import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
} from "@prisma/client";

import { PROD_CRM } from "./seed-simple.ids.js";

// Victor authors the Analysis slice of the cross-author overlay on PROD_CRM.
// ProjectStatus for PROD_CRM already exists from the leads loop.
const SECTION_ID = "a0000000-0000-4000-8000-000000000408";

const ITEMS = [
  {
    id: "a0000000-0000-4000-8000-000000007010",
    reportSectionId: SECTION_ID,
    type: ItemType.current,
    projectId: PROD_CRM,
    text: "Анализ пользовательских сценариев для нового дашборда",
    tag: "analysis",
    workflowStatus: ItemWorkflowStatus.in_progress,
    carriedOver: false,
    stageNames: ["Analysis"],
    priorityRank: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000007011",
    reportSectionId: SECTION_ID,
    type: ItemType.next,
    projectId: PROD_CRM,
    text: "Согласовать схему данных с бэкенд-командой",
    tag: "feature",
    workflowStatus: ItemWorkflowStatus.planned,
    carriedOver: false,
    stageNames: ["Analysis"],
  },
];

export async function seedVictorOverlay(prisma: PrismaClient): Promise<void> {
  await prisma.item.createMany({ data: ITEMS });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009010",
      reportSectionId: SECTION_ID,
      projectId: PROD_CRM,
      risk: "Нет согласованной модели данных — аналитика блокирует разработку",
      impact: "Задержка старта Dev-фазы на 2 недели",
      mitigation: "Виктор организует межкомандный воркшоп по схеме данных",
      severity: "blocked",
      stageNames: ["Analysis"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007012",
      reportSectionId: SECTION_ID,
      productId: PROD_CRM,
      text: "Использовать GraphQL вместо REST для аналитического слоя",
      owner: "Лебедев Виктор",
      impact: "Единая точка доступа, меньше over-fetching",
      stageNames: ["Analysis"],
    },
  });
}
