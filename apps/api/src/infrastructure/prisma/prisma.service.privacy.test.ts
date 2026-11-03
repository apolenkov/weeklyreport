import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Logger } from "@nestjs/common";
import { logs } from "@opentelemetry/api";
import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppLogger } from "../../lib/logger.js";
import { NestAppLoggerAdapter } from "../../lib/nest-app-logger.adapter.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "./prisma.service.js";

const MARKER = "SYNTHETIC_PRISMA_PRIVATE_REPORT_COMMENT";

afterEach(() => {
  Logger.overrideLogger(new Logger());
  vi.restoreAllMocks();
});

describe("PrismaService event logging privacy", () => {
  it.each(["error", "warn"] as const)(
    "keeps %s diagnostics but excludes free-form event fields from every application sink",
    async (level) => {
      const directory = await mkdtemp(join(tmpdir(), "prisma-log-privacy-"));
      const logger = createAppLogger({ minLevel: "debug", logDir: directory });
      Logger.overrideLogger(new NestAppLoggerAdapter(logger));
      const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const emit = vi.fn();
      vi.spyOn(logs, "getLogger").mockReturnValue({
        emit,
        enabled: () => true,
      });
      const service = new PrismaService({
        DATABASE_URL:
          "postgresql://synthetic:synthetic@127.0.0.1:1/no_database",
        DB_POOL_MAX: 1,
        DB_POOL_IDLE_TIMEOUT_MS: 1000,
        DB_POOL_CONNECTION_TIMEOUT_MS: 1,
        LOG_LEVEL: "debug",
      } as EnvConfig);
      const listeners = new Map<string, (event: Prisma.LogEvent) => void>();
      // Only the event source and connection are mocked: the installed service
      // listeners, Nest Logger, adapter and all application sinks stay real.
      const eventSource = service as unknown as {
        $on: (name: string, listener: (event: Prisma.LogEvent) => void) => void;
      };
      vi.spyOn(eventSource, "$on").mockImplementation((name, listener) => {
        listeners.set(name, listener);
      });
      vi.spyOn(service, "$connect").mockResolvedValue(undefined);
      vi.spyOn(service, "$disconnect").mockResolvedValue(undefined);
      try {
        await service.onModuleInit();
        stdout.mockClear();
        stderr.mockClear();
        emit.mockClear();
        const listener = listeners.get(level);
        if (!listener) throw new Error("Prisma log listener not installed");

        listener({
          timestamp: new Date(),
          message: `Invalid create: { text: '${MARKER}' }`,
          target: "ClientEngine",
        });
        listener({
          timestamp: new Date(),
          message: MARKER,
          target: `ClientEngine ${MARKER}`,
        });
        await logger.flush?.();

        const standardOutput = stdout.mock.calls.map((call) => String(call[0]));
        const standardError = stderr.mock.calls.map((call) => String(call[0]));
        const telemetry = JSON.stringify(emit.mock.calls);
        const file = await readFile(join(directory, "app.log"), "utf8");
        for (const sink of [standardOutput, standardError, telemetry, file]) {
          expect(JSON.stringify(sink)).not.toContain(MARKER);
        }
        const selected = level === "error" ? standardError : standardOutput;
        expect(selected).toHaveLength(2);
        expect(level === "error" ? standardOutput : standardError).toEqual([]);
        for (const sink of [selected.join("\n"), telemetry, file]) {
          expect(sink).toContain(`prisma.${level}`);
          expect(sink).toContain("ClientEngine");
          expect(sink).toContain("unknown");
        }
        expect(emit).toHaveBeenCalledTimes(2);
      } finally {
        await service.onModuleDestroy();
        await logger.flush?.();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
