import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import type { EnvConfig } from "../config/env.schema.js";

const SLOW_QUERY_MS = 100;

// pg's own defaults, named so an absent `DB_POOL_*` env tunable resolves to an
// explicit, greppable value. A malformed present value fails boot in
// `env.schema.ts` and never reaches here.
const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 0;

interface ResolvedPoolConfig {
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
}

// Prisma 7 narrows `$on` by the constructor's `log` shape; cast through this
// structural type so event callbacks stay typed without `as any`.
interface PrismaLogEventEmitter {
  $on?: {
    (
      event: "query",
      callback: (e: {
        query: string;
        params: string;
        duration: number;
        target?: string;
      }) => void,
    ): void;
    (event: "warn" | "error", callback: (e: { message: string }) => void): void;
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;
  private readonly poolConfig: ResolvedPoolConfig;

  constructor(private readonly env: EnvConfig) {
    const poolConfig: ResolvedPoolConfig = {
      max: env.DB_POOL_MAX ?? DEFAULT_DB_POOL_MAX,
      idleTimeoutMillis:
        env.DB_POOL_IDLE_TIMEOUT_MS ?? DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis:
        env.DB_POOL_CONNECTION_TIMEOUT_MS ??
        DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
    };
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      ...poolConfig,
    });
    const adapter = new PrismaPg(pool);

    // log:'query' emits a runtime event per SQL; gated to debug-level
    // emission below so info-level prod stays quiet. warn/error come
    // through unconditionally — they're rare and important.
    super({
      adapter,
      log: [
        { level: "query", emit: "event" },
        { level: "warn", emit: "event" },
        { level: "error", emit: "event" },
      ],
    });
    this.pool = pool;
    this.poolConfig = poolConfig;

    // Unhandled pg pool `error` crashes the process; logger takes one string arg.
    pool.on("error", (err: Error) => {
      this.logger.error(
        `pg pool error ${JSON.stringify({ phase: "pg.pool.error", message: err.message })}`,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    const debugEnabled = this.env.LOG_LEVEL === "debug";
    const self = this as unknown as PrismaLogEventEmitter;

    self.$on?.(
      "query",
      (e: {
        query: string;
        params: string;
        duration: number;
        target?: string;
      }) => {
        if (e.duration >= SLOW_QUERY_MS) {
          this.logger.warn(
            `slow query ${JSON.stringify({ phase: "db.query", durationMs: e.duration, query: e.query })}`,
          );
        } else if (debugEnabled) {
          this.logger.debug(`query (${e.duration}ms): ${e.query}`);
        }
      },
    );

    self.$on?.("warn", (e: { message: string }) => {
      this.logger.warn(`prisma: ${e.message}`);
    });

    self.$on?.("error", (e: { message: string }) => {
      this.logger.error(`prisma: ${e.message}`);
    });

    await this.$connect();
    // Emit the resolved pool config on one line so operators can grep a single
    // entry to confirm the size/timeouts pg actually received at boot.
    this.logger.log(
      `Database connection established ${JSON.stringify({ phase: "pg.pool.config", ...this.poolConfig })}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log("Shutting down Prisma...");
    await this.$disconnect();
    await this.pool.end();
    this.logger.log("Database connection closed");
  }
}
