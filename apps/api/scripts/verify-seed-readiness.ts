import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "../../../prisma/_destructive-guard.js";
import { LEAD_1_ID } from "../../../prisma/seed-constants.js";
import { assertSeedCoverage } from "../../../prisma/seed-coverage-check.js";
import { assertSeedAssistantReadiness } from "../src/modules/search/application/seed-readiness.js";
import { ReportSearchPrismaRepository } from "../src/modules/search/infrastructure/report-search.prisma-repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be set");
assertNonProdDestructive("verify-seed-readiness");

const pool = new pg.Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const repository = new ReportSearchPrismaRepository(prisma as never);

const main = async (): Promise<void> => {
  const publishedReports = await prisma.report.findMany({
    where: { periodStatus: "published" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const summary = await assertSeedAssistantReadiness(repository, {
    actorId: LEAD_1_ID,
    label: "seed",
    now: new Date(),
    publishedReportIds: publishedReports.map(({ id }) => id),
  });
  await assertSeedCoverage(prisma, "seed");
  console.log(
    `[verify-seed-readiness] Ready: ${summary.candidateCount} candidates across ` +
      `${summary.currentReportIds.length} current clocks and ` +
      `${summary.publishedReportIds.length} published reports.`,
  );
};

main()
  .catch((error: unknown) => {
    console.error("[verify-seed-readiness] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
