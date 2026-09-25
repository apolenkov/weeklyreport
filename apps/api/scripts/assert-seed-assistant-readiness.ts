import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { requireEnv } from "../../../prisma/guards/_require-env.js";
import {
  LEAD_1,
  REPORT_ACTIVE,
  REPORT_PUBLISHED,
} from "../../../prisma/seeds/simple/seed-simple.ids.js";
import { EXTRA_REPORTS } from "../../../prisma/seeds/simple/seed-simple.period.js";
import {
  LEAD_1_ID,
  SEED_HISTORY_REPORTS,
  SEED_REPORTS,
} from "../../../prisma/seeds/support/seed-constants.js";
import { seedReferenceDate } from "../../../prisma/seeds/support/seed-reference-date.js";
import type { AssistantReadinessOptions } from "./seed-assistant-readiness.js";

type SeedReadinessTier = "full" | "demo";

function isTier(value: string | undefined): value is SeedReadinessTier {
  return value === "full" || value === "demo";
}

function optionsForTier(tier: SeedReadinessTier): AssistantReadinessOptions {
  if (tier === "full") {
    return {
      label: "seed",
      actorId: LEAD_1_ID,
      expectedCurrentReportId: SEED_REPORTS.active.id,
      expectedPublishedReportIds: [
        SEED_REPORTS.published.id,
        ...SEED_HISTORY_REPORTS.map(({ id }) => id),
      ],
      now: seedReferenceDate(),
    };
  }
  return {
    label: "seed-simple",
    actorId: LEAD_1,
    expectedCurrentReportId: REPORT_ACTIVE,
    expectedPublishedReportIds: [
      REPORT_PUBLISHED,
      ...EXTRA_REPORTS.filter(
        ({ publishedAt }) => publishedAt !== undefined,
      ).map(({ id }) => id),
    ],
    now: seedReferenceDate(),
  };
}

async function main(tier: SeedReadinessTier): Promise<void> {
  // Initialize the search provider graph before the helper's repository import.
  await import("../src/modules/search/index.js");
  const { assertAssistantReadiness } =
    await import("./seed-assistant-readiness.js");
  const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const digest = await assertAssistantReadiness(prisma, optionsForTier(tier));
    console.log(
      `[assistant-readiness:${tier}] PASS (${digest.length} candidates)`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const [tier, ...extraArgs] = process.argv.slice(2);
if (!isTier(tier) || extraArgs.length > 0) {
  console.error("Usage: assert-seed-assistant-readiness.ts <full|demo>");
  process.exitCode = 2;
} else {
  void main(tier).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
