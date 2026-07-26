import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
} from "@prisma/client";

import { PROD_CRM } from "./seed-simple.ids.js";

// Galina authors the Design slice of the cross-author overlay on PROD_CRM.
// ProjectStatus for PROD_CRM already exists from the leads loop.
const SECTION_ID = "a0000000-0000-4000-8000-000000000409";

const ITEMS = [
  {
    id: "a0000000-0000-4000-8000-000000007020",
    reportSectionId: SECTION_ID,
    type: ItemType.current,
    projectId: PROD_CRM,
    text: "Разработка UI-kit для нового портала — компоненты форм и таблиц",
    tag: "feature",
    workflowStatus: ItemWorkflowStatus.in_progress,
    carriedOver: false,
    stageNames: ["Design"],
    priorityRank: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000007021",
    reportSectionId: SECTION_ID,
    type: ItemType.next,
    projectId: PROD_CRM,
    text: "Провести usability-тест с 5 пользователями по прототипу",
    tag: "analysis",
    workflowStatus: ItemWorkflowStatus.planned,
    carriedOver: false,
    stageNames: ["Design"],
  },
];

export async function seedGalinaOverlay(prisma: PrismaClient): Promise<void> {
  await prisma.item.createMany({ data: ITEMS });
  await prisma.risk.create({
    data: {
      id: "a0000000-0000-4000-8000-000000009020",
      reportSectionId: SECTION_ID,
      projectId: PROD_CRM,
      risk: "Figma-прототип не согласован с PM — риск переработки верстки",
      impact: "Переработка компонентов на этапе Dev",
      mitigation: "Галина организует review с Boris и стейкхолдерами",
      severity: "at-risk",
      stageNames: ["Design"],
    },
  });
  await prisma.decision.create({
    data: {
      id: "a0000000-0000-4000-8000-000000007022",
      reportSectionId: SECTION_ID,
      productId: PROD_CRM,
      text: "Принять Material Design 3 как базовую дизайн-систему для портала",
      owner: "Михайлова Галина",
      impact: "Ускоряет разработку компонентов на 30%",
      stageNames: ["Design"],
    },
  });
}
