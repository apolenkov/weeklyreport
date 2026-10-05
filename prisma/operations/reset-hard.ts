// Drop all app rows, flush the Redis DB assigned to the target database, and seed a profile.

import { spawnSync } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

// Load .env from the repo root regardless of cwd. The script may be invoked
// via `pnpm --filter @customreport/api exec tsx ../../prisma/operations/reset-hard.ts`,
// in which case cwd is apps/api (no .env), or directly from the repo root.
const REPO_ROOT = resolve(import.meta.dirname, "../..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

// Keep the Prisma imports below loadEnv so this script still resolves the repo
// root environment consistently when launched from the API workspace.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import {
  assertE2eRuntimeDestructive,
  parseE2eRuntimeRedisTarget,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { requireEnv } from "../guards/_require-env.js";
import { parseSeedProfile } from "../seeds/profiles/seed-profile-contract.js";

const REDIS_FLUSH_TIMEOUT_MS = 5000;

function writeRedisCommand(command: string, ...args: string[]): Buffer {
  const parts = [command, ...args];
  return Buffer.from(
    `*${parts.length}\r\n${parts
      .map((part) => `$${Buffer.byteLength(part)}\r\n${part}`)
      .join("\r\n")}\r\n`,
    "utf8",
  );
}

interface RespFrame {
  readonly value: unknown;
  readonly rest: string;
}

function parseRespAggregateFrame(
  buffer: string,
  lineEnd: number,
  type: string,
  line: string,
): RespFrame | undefined {
  const count = Number(line);
  if (!Number.isInteger(count) || count < -1)
    throw new Error(`Redis returned malformed RESP ${type} frame`);
  if (count === -1) return { value: null, rest: buffer.slice(lineEnd + 2) };
  if (type === "*") return parseRespArray(buffer.slice(lineEnd + 2), count);
  const start = lineEnd + 2;
  const end = start + count;
  if (buffer.length < end + 2) return undefined;
  if (buffer.slice(end, end + 2) !== "\r\n")
    throw new Error("Redis returned malformed bulk-string frame");
  return { value: buffer.slice(start, end), rest: buffer.slice(end + 2) };
}

function parseRespFrame(buffer: string): RespFrame | undefined {
  const type = buffer[0];
  if (type === undefined) return undefined;
  const lineEnd = buffer.indexOf("\r\n", 1);
  if (lineEnd === -1) return undefined;
  const line = buffer.slice(1, lineEnd);
  if (type === "+" || type === "-" || type === ":") {
    return {
      value: type === ":" ? Number(line) : `${type}${line}`,
      rest: buffer.slice(lineEnd + 2),
    };
  }
  if (type === "$" || type === "*")
    return parseRespAggregateFrame(buffer, lineEnd, type, line);
  throw new Error(`Redis returned unsupported RESP frame type: ${type}`);
}

function parseRespArray(buffer: string, count: number): RespFrame | undefined {
  let rest = buffer;
  const values: unknown[] = [];
  for (let index = 0; index < count; index += 1) {
    const frame = parseRespFrame(rest);
    if (frame === undefined) return undefined;
    values.push(frame.value);
    rest = frame.rest;
  }
  return { value: values, rest };
}

function getRedisReplyError(
  value: unknown,
  replyCount: number,
  db: string,
): Error | undefined {
  if (value === "+OK") return undefined;
  const command = replyCount === 0 ? `SELECT ${db}` : "FLUSHDB";
  const detail =
    typeof value === "string" && value.startsWith("-")
      ? `failed: ${value}`
      : `returned unexpected reply: ${String(value)}`;
  return new Error(`Redis ${command} ${detail}`);
}

export async function flushRedis(): Promise<void> {
  assertE2eRuntimeDestructive("reset-hard-flush-redis");
  const { host, port, db } = parseE2eRuntimeRedisTarget(
    "reset-hard-flush-redis",
  );
  console.log(
    `[reset-hard] Redis target: ${host}:${port} (REDIS_HOST/REDIS_PORT)`,
  );

  await new Promise<void>((resolve, reject) => {
    const sock = net.createConnection({ host, port }, () => {
      // Never pipeline FLUSHDB: if SELECT were rejected, a pipelined flush
      // would run against Redis' default DB 0.
      sock.write(writeRedisCommand("SELECT", db));
    });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(
        new Error(`Redis SELECT ${db} + FLUSHDB timed out at ${host}:${port}`),
      );
    }, REDIS_FLUSH_TIMEOUT_MS);
    let buffered = "";
    let replies = 0;
    const readReplies = (): void => {
      while (replies < 2) {
        const frame = parseRespFrame(buffered);
        if (frame === undefined) return;
        buffered = frame.rest;
        const replyError = getRedisReplyError(frame.value, replies, db);
        if (replyError) {
          clearTimeout(timer);
          sock.end();
          reject(replyError);
          return;
        }
        replies += 1;
        if (replies === 1) sock.write(writeRedisCommand("FLUSHDB"));
      }
      clearTimeout(timer);
      sock.end();
      resolve();
    };
    sock.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      try {
        readReplies();
      } catch (error: unknown) {
        clearTimeout(timer);
        sock.destroy();
        reject(error);
      }
    });
    sock.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // Settling twice is a no-op, so this only bites when +OK never arrived.
    sock.on("end", () => {
      clearTimeout(timer);
      reject(
        new Error(
          `Redis SELECT ${db} + FLUSHDB: connection closed before both replies were received (got ${replies}/2)`,
        ),
      );
    });
  });

  console.log(`[reset-hard] Redis DB ${db} FLUSHDB: OK`);
}

// PostgreSQL identifiers are quoted by doubling embedded quotes (the dialect's
// escape rule); without it a legal quoted table name breaks the statement.
export function quotePgIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function truncateAll(prisma: PrismaClient): Promise<void> {
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
  const quoted = rows.map((r) => quotePgIdentifier(r.tablename)).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`,
  );
  console.log(
    `[reset-hard] TRUNCATE ${rows.length} tables: OK (${rows.map((r) => r.tablename).join(", ")})`,
  );
}

export async function runResetHard(): Promise<void> {
  const profile = parseSeedProfile(process.argv[2]);
  assertE2eRuntimeDestructive("reset-hard");
  const databaseUrl = requireEnv("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("[reset-hard] Starting hard reset…");

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

    await truncateAll(prisma);
    await flushRedis();

    console.log(`[reset-hard] Re-seeding profile ${profile}…`);
    const seed = spawnSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- pnpm (workspace package manager) invoked intentionally in dev-only seeding; shell:false set
      "pnpm",
      [
        "--filter",
        "@customreport/api",
        "exec",
        "tsx",
        "../../prisma/seeds/profiles/seed-profile.ts",
        profile,
      ],
      {
        stdio: "inherit",
        shell: false,
        cwd: REPO_ROOT,
        env: { ...process.env },
      },
    );
    if (seed.status !== 0) {
      throw new Error(
        `seed profile ${profile} exited with code ${seed.status ?? "unknown"}`,
      );
    }

    console.log(
      "[reset-hard] Done. Database + Redis are at the post-seed baseline.",
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void runResetHard().catch((error: unknown) => {
    console.error("[reset-hard] FAILED:", error);
    process.exitCode = 1;
  });
}
