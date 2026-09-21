import type { PrismaClient } from "@prisma/client";

import {
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
} from "../support/seed-constants.js";
import {
  LEAD_SLOT_DMITRY,
  LEAD_SLOT_IGOR,
  LEAD_SLOT_PRIMARY,
  PRODUCT_DEVOPS_TOOLS,
  PRODUCT_INTERNAL_BI,
  PRODUCT_MARKETING_PORTAL,
  STAGE_NAME_DEVELOPMENT,
  STAGE_NAME_DEVOPS,
  STAGE_NAME_SUPPORT,
} from "./seed-advanced.anchors.js";
import { ACTIVE_SUFFIX, decisionId, sectionId } from "./seed-advanced.ids.js";
import { activeOffset } from "./seed-advanced.period.js";
import {
  ownedStageName,
  type StageOwnership,
} from "./seed-advanced.stage-names.js";

// Days after the period's Monday: the decisions fall due early next week.
const NEXT_TUESDAY = 8;
const NEXT_WEDNESDAY = 9;
const NEXT_THURSDAY = 10;
const MIDDAY_UTC = 12;
const AFTERNOON_UTC = 15;
const EVENING_UTC = 18;

const DECISION_SEQ = { oauthQuota: 1, pgBouncerWindow: 2, wafRollout: 3 };

// Russian-language decisions for the head to action.
const DECISION_ROWS = [
  {
    id: decisionId(DECISION_SEQ.oauthQuota),
    stableId: decisionId(DECISION_SEQ.oauthQuota),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    authorId: LEAD_1_ID,
    productId: PRODUCT_MARKETING_PORTAL,
    text: "Согласовать расширение OAuth2 квоты у партнёра (нужен sign-off head)",
    owner: "Василий И.",
    deadline: activeOffset(NEXT_TUESDAY, AFTERNOON_UTC),
    impact: "Разблокирует выкатку SSO portal на 100% трафика",
    stageName: STAGE_NAME_DEVELOPMENT,
  },
  {
    id: decisionId(DECISION_SEQ.pgBouncerWindow),
    stableId: decisionId(DECISION_SEQ.pgBouncerWindow),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_IGOR),
    authorId: LEAD_IGOR_ID,
    productId: PRODUCT_INTERNAL_BI,
    text: "Утвердить maintenance-window для миграции PgBouncer (Сб 02:00 МСК)",
    owner: "Игорь В.",
    deadline: activeOffset(NEXT_WEDNESDAY, EVENING_UTC),
    impact: "Закрывает tech-debt по пулу соединений, разгружает p99",
    stageName: STAGE_NAME_DEVOPS,
  },
  {
    id: decisionId(DECISION_SEQ.wafRollout),
    stableId: decisionId(DECISION_SEQ.wafRollout),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_DMITRY),
    authorId: LEAD_DMITRY_ID,
    productId: PRODUCT_DEVOPS_TOOLS,
    text: "Дать зелёный свет фазовой раскатке WAF в shadow-mode",
    owner: "Дмитрий С.",
    deadline: activeOffset(NEXT_THURSDAY, MIDDAY_UTC),
    impact: "Снижает риск инцидентов на проде, безопасный rollback",
    stageName: STAGE_NAME_SUPPORT,
  },
];

/** Seeds the head's decision queue; returns the row count for the summary. */
export async function seedDecisions(
  prisma: PrismaClient,
  ownership?: StageOwnership,
): Promise<number> {
  for (const { id, authorId, stageName, ...fields } of DECISION_ROWS) {
    const stageNames = [
      ownedStageName(authorId, fields.productId, stageName, ownership),
    ];
    await prisma.decision.upsert({
      where: { id },
      update: { ...fields, stageNames },
      create: { id, ...fields, stageNames },
    });
  }
  return DECISION_ROWS.length;
}
