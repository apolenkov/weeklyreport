import type { PrismaClient } from "@prisma/client";

import type { Tier } from "./seed-demo.types.js";

export async function logSeedCounts(
  prisma: PrismaClient,
  tier: Tier,
): Promise<void> {
  const counts = {
    users: await prisma.user.count(),
    products: await prisma.project.count({ where: { archived: false } }),
    stages: await prisma.stage.count(),
    reports: await prisma.report.count(),
    sections: await prisma.reportSection.count(),
    items: await prisma.item.count(),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
  };
  console.log(`[seed-demo:${tier}] Done: ${JSON.stringify(counts)}`);
}
