import type {
  BeforeApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const SLOW_QUERY_MS = 100;

// Prisma 7's PrismaClient type narrows `$on` differently depending on the
// constructor's `log` shape, and TypeScript cannot always reconcile the two
// (the source of the former `this as any`). Cast through this minimal
// structural type instead, so the event callbacks stay fully typed and the
// no-unsafe-* family has a real type to check against.
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
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new pg.Pool({ connectionString });
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
  }

  async onModuleInit(): Promise<void> {
    // Wire query/error/warn event listeners. `$on` is reached through the
    // PrismaLogEventEmitter structural cast (see above) because Prisma 7's
    // Client type narrows $on differently depending on the constructor's `log`
    // shape and TypeScript can't always reconcile the two.
    const debugEnabled = (process.env.LOG_LEVEL ?? "info") === "debug";
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
          // Slow query — always log at warn-level so it shows up even in
          // production logs without flipping the global LOG_LEVEL.
          this.logger.warn(
            `slow query ${JSON.stringify({ phase: "db.query", durationMs: e.duration, query: e.query })}`,
          );
        } else if (debugEnabled) {
          // Verbose per-query trace — only when explicitly debugging.
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
    this.logger.log("Database connection established");
  }

  beforeApplicationShutdown(): void {
    this.logger.log("Shutting down Prisma...");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log("Database connection closed");
  }
}
