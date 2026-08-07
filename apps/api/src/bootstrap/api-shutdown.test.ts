import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../lib/logger.js";
import { type ApiShutdownDependencies, shutdownApi } from "./api-shutdown.js";

const dependenciesFor = (
  order: string[],
  overrides: Partial<ApiShutdownDependencies> = {},
): ApiShutdownDependencies => {
  const logger: AppLogger = {
    debug: () => undefined,
    info: (message) => order.push(`log:${message}`),
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
    flush: () => {
      order.push("file-flush");
      return Promise.resolve();
    },
  };
  return {
    app: {
      close: () => {
        order.push("app-close");
        return Promise.resolve();
      },
    },
    logger,
    shutdownOtel: () => {
      order.push("otel-shutdown");
      return Promise.resolve();
    },
    shutdownSentry: () => {
      order.push("sentry-close");
      return Promise.resolve();
    },
    writeCompletion: () => {
      order.push("completion-write");
      return Promise.resolve();
    },
    ...overrides,
  };
};

describe("API shutdown", () => {
  afterEach(() => vi.useRealTimers());

  it("drains application, file logs, OTel, and Sentry in order", async () => {
    const order: string[] = [];

    await shutdownApi(dependenciesFor(order));

    expect(order).toEqual([
      "app-close",
      "log:API shutdown log barrier reached",
      "file-flush",
      "otel-shutdown",
      "sentry-close",
      "completion-write",
    ]);
  });

  it("attempts every telemetry drain and rejects when an earlier step fails", async () => {
    const order: string[] = [];
    const dependencies = dependenciesFor(order, {
      app: {
        close: () => {
          order.push("app-close-failed");
          return Promise.reject(new Error("close failed"));
        },
      },
    });

    await expect(shutdownApi(dependencies)).rejects.toThrow(
      "API shutdown telemetry drain failed",
    );
    expect(order).toContain("file-flush");
    expect(order).toContain("otel-shutdown");
    expect(order).toContain("sentry-close");
    expect(order).not.toContain("completion-write");
  });

  it("keeps the deadline alive and attempts every drain after a hung close", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const dependencies = dependenciesFor(order, {
      app: {
        close: () => {
          order.push("app-close-hung");
          return new Promise(() => undefined);
        },
      },
    });

    const shutdown = shutdownApi(dependencies);
    const rejection = expect(shutdown).rejects.toThrow(
      "API shutdown telemetry drain failed",
    );
    await vi.advanceTimersByTimeAsync(3000);
    await rejection;

    expect(order).toContain("file-flush");
    expect(order).toContain("otel-shutdown");
    expect(order).toContain("sentry-close");
    expect(order).not.toContain("completion-write");
  });

  it("does not publish completion after a Sentry drain failure", async () => {
    const order: string[] = [];
    const dependencies = dependenciesFor(order, {
      shutdownSentry: () => {
        order.push("sentry-close-failed");
        return Promise.reject(new Error("Sentry failed"));
      },
    });

    await expect(shutdownApi(dependencies)).rejects.toThrow(
      "API shutdown telemetry drain failed",
    );

    expect(order).toContain("log:API shutdown log barrier reached");
    expect(order).not.toContain("completion-write");
  });

  it("attempts every drain when barrier logging throws", async () => {
    const order: string[] = [];
    const baseline = dependenciesFor(order);
    const dependencies = dependenciesFor(order, {
      logger: {
        ...baseline.logger,
        info: () => {
          throw new Error("barrier failed");
        },
      },
    });

    await expect(shutdownApi(dependencies)).rejects.toThrow(
      "API shutdown telemetry drain failed",
    );

    expect(order).toContain("file-flush");
    expect(order).toContain("otel-shutdown");
    expect(order).toContain("sentry-close");
    expect(order).not.toContain("completion-write");
  });
});
