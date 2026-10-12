import type { Logger } from "@nestjs/common";
import type pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "./prisma.service.js";

interface QueryLogEvent {
  readonly query: string;
  readonly params: string;
  readonly duration: number;
  readonly target?: string;
}

type PrismaLogListener = (
  event: QueryLogEvent | { readonly message: string },
) => void;

// PrismaService creates a real (lazy, unconnected) pg.Pool in its constructor;
// these tests never issue a query, so no live database is touched. The pool is
// closed in afterEach to avoid a leaked handle.
const openServices: PrismaService[] = [];

function makeService(overrides: Partial<EnvConfig> = {}): PrismaService {
  const env = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/weeklyreport_test",
    DB_POOL_MAX: 10,
    DB_POOL_IDLE_TIMEOUT_MS: 10_000,
    DB_POOL_CONNECTION_TIMEOUT_MS: 0,
    ...overrides,
  } as EnvConfig;
  const service = new PrismaService(env);
  openServices.push(service);
  return service;
}

function poolOf(service: PrismaService): pg.Pool {
  return (service as unknown as { pool: pg.Pool }).pool;
}

function loggerOf(service: PrismaService): Logger {
  return (service as unknown as { logger: Logger }).logger;
}

async function captureQueryListener(
  service: PrismaService,
): Promise<(event: QueryLogEvent) => void> {
  const listeners = new Map<string, PrismaLogListener>();
  const eventSource = service as unknown as {
    $on: (event: string, listener: PrismaLogListener) => void;
  };
  vi.spyOn(eventSource, "$on").mockImplementation((event, listener) => {
    listeners.set(event, listener);
  });
  vi.spyOn(service, "$connect").mockResolvedValue(undefined);

  await service.onModuleInit();

  const listener = listeners.get("query");
  if (!listener) throw new Error("query listener was not registered");
  return listener;
}

afterEach(async () => {
  // Restore first: tests may mock pool.end to reject, and the real close
  // must still run here.
  vi.restoreAllMocks();
  await Promise.all(openServices.splice(0).map((s) => poolOf(s).end()));
});

describe("PrismaService pool error listener", () => {
  it("routes an idle pool error to logger.error as one embedded string, no crash", () => {
    const service = makeService();
    const errorSpy = vi
      .spyOn(loggerOf(service), "error")
      .mockImplementation(() => undefined);

    // Emitting `error` on an EventEmitter with no listener throws; the fact
    // that this does NOT throw proves the crash-prevention listener is wired.
    expect(() =>
      poolOf(service).emit(
        "error",
        new Error("connection terminated unexpectedly"),
      ),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0];
    if (!call) throw new Error("logger.error was not called");
    // Exactly one argument: a second arg would be swallowed as the Nest log
    // context and the payload would render as "[object Object]".
    expect(call).toHaveLength(1);
    expect(call[0]).toBeTypeOf("string");
    const message = String(call[0]);
    expect(message).toContain('"phase":"pg.pool.error"');
    expect(message).toContain("connection terminated unexpectedly");
  });
});

describe("PrismaService pool configuration", () => {
  it("applies the explicit pool policy at boot", async () => {
    const service = makeService();
    vi.spyOn(service, "$connect").mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(loggerOf(service), "log")
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"max":10');
    expect(logged).toContain('"idleTimeoutMillis":10000');
    expect(logged).toContain('"connectionTimeoutMillis":0');
  });

  it("hands the resolved config to pg.Pool and logs the same values at boot", async () => {
    const service = makeService({
      DB_POOL_MAX: 25,
      DB_POOL_IDLE_TIMEOUT_MS: 5000,
      DB_POOL_CONNECTION_TIMEOUT_MS: 2000,
    });
    const pool = poolOf(service);
    // Skip the real DB round-trip; onModuleInit's job under test is the log.
    vi.spyOn(service, "$connect").mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(loggerOf(service), "log")
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    // The value handed to pg...
    expect(pool.options.max).toBe(25);
    expect(pool.options.idleTimeoutMillis).toBe(5000);
    expect(pool.options.connectionTimeoutMillis).toBe(2000);
    // ...must equal the value logged at boot (the "boot log must not lie" case).
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"max":25');
    expect(logged).toContain('"idleTimeoutMillis":5000');
    expect(logged).toContain('"connectionTimeoutMillis":2000');
  });
});

describe("PrismaService query logging", () => {
  it("warns for a query exactly at the slow-query threshold", async () => {
    const service = makeService({ LOG_LEVEL: "info" });
    const warnSpy = vi
      .spyOn(loggerOf(service), "warn")
      .mockImplementation(() => undefined);
    const debugSpy = vi
      .spyOn(loggerOf(service), "debug")
      .mockImplementation(() => undefined);
    const queryListener = await captureQueryListener(service);

    queryListener({
      query: "SELECT slow",
      params: "[]",
      duration: 100,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'slow query {"phase":"db.query","durationMs":100,"query":"SELECT slow"}',
    );
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("logs fast queries only when debug logging is enabled", async () => {
    const infoService = makeService({ LOG_LEVEL: "info" });
    const debugService = makeService({ LOG_LEVEL: "debug" });
    const infoDebugSpy = vi
      .spyOn(loggerOf(infoService), "debug")
      .mockImplementation(() => undefined);
    const debugSpy = vi
      .spyOn(loggerOf(debugService), "debug")
      .mockImplementation(() => undefined);
    const infoQueryListener = await captureQueryListener(infoService);
    const debugQueryListener = await captureQueryListener(debugService);
    const fastQuery = {
      query: "SELECT fast",
      params: "[]",
      duration: 99,
    };

    infoQueryListener(fastQuery);
    debugQueryListener(fastQuery);

    expect(infoDebugSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith("query (99ms): SELECT fast");
  });
});

describe("PrismaService shutdown logging", () => {
  it("logs shutdown before closing the database connection", async () => {
    const service = makeService();
    const disconnectGate = Promise.withResolvers<void>();
    const poolEndGate = Promise.withResolvers<void>();
    const disconnectSpy = vi
      .spyOn(service, "$disconnect")
      .mockReturnValue(disconnectGate.promise);
    const poolEndSpy = vi
      .spyOn(poolOf(service), "end")
      .mockReturnValue(poolEndGate.promise as unknown as void);
    const logSpy = vi
      .spyOn(loggerOf(service), "log")
      .mockImplementation(() => undefined);

    const shutdown = service.onModuleDestroy();
    await Promise.resolve();

    expect(logSpy).toHaveBeenNthCalledWith(1, "Shutting down Prisma...");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledOnce();
    expect(poolEndSpy).not.toHaveBeenCalled();

    disconnectGate.resolve();
    // A macrotask flushes every queued microtask in the disconnect→end chain.
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(poolEndSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledTimes(1);

    poolEndGate.resolve();
    await shutdown;

    expect(disconnectSpy).toHaveBeenCalledOnce();
    expect(poolEndSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenNthCalledWith(2, "Database connection closed");
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it("still ends the owned pool when $disconnect rejects, and rethrows that error", async () => {
    const service = makeService();
    const disconnectError = new Error("disconnect failed");
    vi.spyOn(service, "$disconnect").mockRejectedValue(disconnectError);
    const poolEndSpy = vi
      .spyOn(poolOf(service), "end")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(loggerOf(service), "log")
      .mockImplementation(() => undefined);

    await expect(service.onModuleDestroy()).rejects.toBe(disconnectError);

    expect(poolEndSpy).toHaveBeenCalledOnce();
    // The pool did close — the closed log stays honest.
    expect(logSpy).toHaveBeenCalledWith("Database connection closed");
  });

  it("propagates a pool.end failure without logging a close", async () => {
    const service = makeService();
    vi.spyOn(service, "$disconnect").mockResolvedValue(undefined);
    const endError = new Error("pool end failed");
    vi.spyOn(poolOf(service), "end").mockRejectedValue(endError);
    const logSpy = vi
      .spyOn(loggerOf(service), "log")
      .mockImplementation(() => undefined);

    await expect(service.onModuleDestroy()).rejects.toBe(endError);

    expect(logSpy).not.toHaveBeenCalledWith("Database connection closed");
  });

  it("throws an AggregateError carrying both failures when both steps reject", async () => {
    const service = makeService();
    const disconnectError = new Error("disconnect failed");
    const endError = new Error("pool end failed");
    vi.spyOn(service, "$disconnect").mockRejectedValue(disconnectError);
    const poolEndSpy = vi
      .spyOn(poolOf(service), "end")
      .mockRejectedValue(endError);

    const failure = await service.onModuleDestroy().then(
      () => {
        throw new Error("expected rejection");
      },
      (error: unknown) => error,
    );

    expect(poolEndSpy).toHaveBeenCalledOnce();
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      disconnectError,
      endError,
    ]);
  });
});
