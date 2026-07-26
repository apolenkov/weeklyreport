// Drop all app rows, flush Redis, re-seed (seed-simple). Requires healthy postgres+redis.

import { spawnSync } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

// Load .env from the repo root regardless of cwd. The script may be invoked
// via `pnpm --filter @customreport/api exec tsx ../../prisma/reset-hard.ts`,
// in which case cwd is apps/api (no .env), or directly from the repo root.
const REPO_ROOT = resolve(import.meta.dirname, "..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

// The imports below read DATABASE_URL at module-evaluation time, so they must
// stay under loadEnv — hoisting them to the top block breaks the script.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { isEntrypoint } from "./_entrypoint.js";

const DATABASE_URL: string = (() => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set in .env");
  return url;
})();
interface RedisEndpoint {
  readonly host: string;
  readonly port: number;
  readonly source: "REDIS_URL" | "REDIS_HOST/REDIS_PORT";
}

// Redis' own default listening port — used when neither REDIS_URL nor
// REDIS_PORT pins one (dev/compose convenience, not product config).
const DEFAULT_REDIS_PORT = 6379;
// A local FLUSHALL answers in milliseconds; this only bounds a hung socket.
const REDIS_FLUSHALL_TIMEOUT_MS = 5000;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getRedisEndpoint(): RedisEndpoint {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    const port = Number(url.port || DEFAULT_REDIS_PORT);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`Invalid Redis port in REDIS_URL: ${url.port}`);
    }
    if (!url.hostname) {
      throw new Error(`REDIS_URL has no host: ${redisUrl}`);
    }
    return {
      host: url.hostname,
      port,
      source: "REDIS_URL",
    };
  }

  const port = Number(process.env.REDIS_PORT ?? DEFAULT_REDIS_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid REDIS_PORT: ${process.env.REDIS_PORT ?? "unset"}`);
  }
  const host = process.env.REDIS_HOST;
  if (!host) {
    throw new Error("REDIS_HOST must be set in .env (or provide REDIS_URL)");
  }
  return {
    host,
    port,
    source: "REDIS_HOST/REDIS_PORT",
  };
}

function writeRedisCommand(command: string, ...args: string[]): Buffer {
  const parts = [command, ...args];
  return Buffer.from(
    `*${parts.length}\r\n${parts
      .map((part) => `$${Buffer.byteLength(part)}\r\n${part}`)
      .join("\r\n")}\r\n`,
    "utf8",
  );
}

export async function flushRedis(): Promise<void> {
  const { host, port, source } = getRedisEndpoint();
  console.log(`[reset-hard] Redis target: ${host}:${port} (${source})`);

  await new Promise<void>((resolve, reject) => {
    const sock = net.createConnection({ host, port }, () => {
      sock.write(writeRedisCommand("FLUSHALL"));
    });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`Redis FLUSHALL timed out at ${host}:${port}`));
    }, REDIS_FLUSHALL_TIMEOUT_MS);
    // The reply can arrive split across segments; carrying the bytes seen so
    // far as an argument keeps the accumulator out of a mutable binding.
    const readReply = (buffered: string): void => {
      if (buffered.startsWith("+OK")) {
        clearTimeout(timer);
        sock.end();
        resolve();
      } else if (buffered.startsWith("-")) {
        clearTimeout(timer);
        sock.end();
        reject(new Error(`Redis FLUSHALL failed: ${buffered.trim()}`));
      } else {
        sock.once("data", (chunk: Buffer) => {
          readReply(buffered + chunk.toString("utf8"));
        });
      }
    };
    sock.once("data", (chunk: Buffer) => {
      readReply(chunk.toString("utf8"));
    });
    sock.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // Settling twice is a no-op, so this only bites when +OK never arrived.
    sock.on("end", () => {
      clearTimeout(timer);
      reject(
        new Error("Redis FLUSHALL: connection closed before +OK was received"),
      );
    });
  });

  console.log("[reset-hard] Redis FLUSHALL: OK");
}

async function truncateAll(): Promise<void> {
  // Discover every table in the public schema except prisma's bookkeeping
  // table — schema drift between repo and DB doesn't break the wipe this way.
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    String.raw`SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT LIKE '\_prisma%'
         AND tablename NOT LIKE 'pg_%'
       ORDER BY tablename`,
  );
  if (rows.length === 0) {
    console.warn("[reset-hard] No app tables found in public schema");
    return;
  }
  const quoted = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`,
  );
  console.log(
    `[reset-hard] TRUNCATE ${rows.length} tables: OK (${rows.map((r) => r.tablename).join(", ")})`,
  );
}

async function main(): Promise<void> {
  assertNonProdDestructive("reset-hard");

  console.log("[reset-hard] Starting hard reset…");
  console.log(
    `[reset-hard] DATABASE_URL: ${DATABASE_URL.replace(/:[^:@]*@/, ":***@")}`,
  );

  // Apply any pending migrations first so schema matches Prisma client.
  // This prevents "not-null constraint" errors from schema drift.
  console.log("[reset-hard] Applying pending migrations…");
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- pnpm (workspace package manager) invoked intentionally in dev-only DB reset; shell:false set
  const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: false,
    cwd: REPO_ROOT,
    env: { ...process.env },
  });
  if (migrate.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed with exit code ${migrate.status ?? "unknown"}`,
    );
  }

  await truncateAll();
  await flushRedis();

  console.log("[reset-hard] Re-seeding via seed-simple…");
  // Invoke seed-simple via the api workspace so tsx is on PATH, and pass
  // process.env explicitly so dotenv-loaded DATABASE_URL crosses the boundary
  // even though seed-simple.ts itself only reads dotenv from its own cwd.
  const seed = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- pnpm (workspace package manager) invoked intentionally in dev-only seeding; shell:false set
    "pnpm",
    [
      "--filter",
      "@customreport/api",
      "exec",
      "tsx",
      "../../prisma/seed-simple.ts",
    ],
    {
      stdio: "inherit",
      shell: false,
      cwd: REPO_ROOT,
      env: { ...process.env },
    },
  );
  if (seed.status !== 0) {
    throw new Error(`seed-simple exited with code ${seed.status ?? "unknown"}`);
  }

  console.log(
    "[reset-hard] Done. Database + Redis are at the post-seed baseline.",
  );
}

if (isEntrypoint(import.meta.url)) {
  void main()
    .catch((error: unknown) => {
      console.error("[reset-hard] FAILED:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
