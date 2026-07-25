// Factory-reset wipe + reseed for manual UAT; reuses seed-constants IDs for E2E stability.

import "dotenv/config";

import net from "node:net";

import { PrismaPg } from "@prisma/adapter-pg";
import { PeriodStatus, type Prisma, PrismaClient, Role } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { requireEnv } from "./_require-env.js";
import { seedBaseline } from "./wipe-manual-uat.seed-baseline.js";
import { seedActivePeriod } from "./wipe-manual-uat.seed-period.js";
import { wipeAll } from "./wipe-manual-uat.wipe.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// A local FLUSHDB answers in milliseconds; this only bounds a hung socket.
const REDIS_FLUSH_TIMEOUT_MS = 5000;
// Redis error replies are unbounded; keep the recorded reason loggable.
const REDIS_REASON_MAX_CHARS = 200;

// Default Prisma tx timeout is 5s; full wipe + 30+ creates needs more
// headroom. tRPC ceiling for the manual-uat variant is 60s (trpc.router.ts),
// so stay well under.
const WIPE_TX_TIMEOUT_MS = 30_000;
const WIPE_TX_MAX_WAIT_MS = 10_000;

function writeRedisCommand(command: string, ...args: string[]): Buffer {
  const parts = [command, ...args];
  return Buffer.from(
    `*${parts.length}\r\n${parts
      .map((part) => `$${Buffer.byteLength(part)}\r\n${part}`)
      .join("\r\n")}\r\n`,
    "utf8",
  );
}

export async function flushRedisDb(): Promise<
  { flushed: true } | { flushed: false; reason: string }
> {
  if (process.env.MANUAL_UAT_WIPE_FLUSH_REDIS === "false") {
    return { flushed: false, reason: "disabled-by-env" };
  }

  const host = requireEnv("REDIS_HOST");
  const port = Number(requireEnv("REDIS_PORT"));
  if (!Number.isInteger(port) || port <= 0) {
    return { flushed: false, reason: "invalid-redis-port" };
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    // First settlement wins — every later resolve() is a no-op, so the
    // outcomes stay exclusive without a hand-rolled "already settled" flag.
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ flushed: false, reason: "timeout" });
    }, REDIS_FLUSH_TIMEOUT_MS);

    // Stream accumulator: a reply may span chunks, and only the first
    // CRLF-terminated line decides the outcome.
    let response = "";
    socket.once("connect", () => {
      socket.write(writeRedisCommand("FLUSHDB"));
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\r\n")) return;
      clearTimeout(timer);
      socket.end();
      resolve(
        response.startsWith("+OK")
          ? { flushed: true }
          : {
              flushed: false,
              reason: response.trim().slice(0, REDIS_REASON_MAX_CHARS),
            },
      );
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ flushed: false, reason: error.message });
    });
    socket.once("close", () => {
      clearTimeout(timer);
      resolve({ flushed: false, reason: "closed-before-reply" });
    });
  });
}

// Post-reseed row counts, printed so a manual run can eyeball the result.
async function countAfterReseed(tx: Prisma.TransactionClient) {
  return {
    users: await tx.user.count(),
    leads: await tx.user.count({ where: { role: Role.lead } }),
    reportingGroups: await tx.reportingGroup.count(),
    projects: await tx.project.count({ where: { archived: false } }),
    groupProducts: await tx.groupProduct.count(),
    stages: await tx.stage.count(),
    stageAssignments: await tx.stageAssignment.count(),
    organization: await tx.organization.count(),
    appSettings: await tx.appSettings.count(),
    reports: await tx.report.count(),
    openReports: await tx.report.count({
      where: { periodStatus: PeriodStatus.open },
    }),
    sections: await tx.reportSection.count(),
    reminderRules: await tx.reminderRule.count(),
    reminderPolicies: await tx.reminderPolicy.count(),
    userActionLog: await tx.userActionLog.count(),
    telegramBindings: await tx.telegramBinding.count(),
  };
}

// Wipe + reseed as ONE transaction: every phase below runs in FK-safe order,
// and a failure anywhere leaves the database untouched.
async function wipeAndReseed(tx: Prisma.TransactionClient) {
  const deleted = await wipeAll(tx);
  await seedBaseline(tx);
  const { report, leadSections } = await seedActivePeriod(tx);
  const after = await countAfterReseed(tx);

  return {
    deleted,
    after,
    activeReport: {
      id: report.id,
      weekLabel: report.weekLabel,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      leadSections,
    },
  };
}

async function main() {
  assertNonProdDestructive("wipe-manual-uat");

  const result = await prisma.$transaction(wipeAndReseed, {
    timeout: WIPE_TX_TIMEOUT_MS,
    maxWait: WIPE_TX_MAX_WAIT_MS,
  });

  const redis = await flushRedisDb();

  console.log(
    `[wipe-manual-uat] Done: ${JSON.stringify({ ...result, redis })}`,
  );
}

if (typeof require !== "undefined" && require.main === module) {
  void main()
    .catch((error: unknown) => {
      console.error("[wipe-manual-uat] Failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
