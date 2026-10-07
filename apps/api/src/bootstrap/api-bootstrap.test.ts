import type { INestApplication } from "@nestjs/common";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../infrastructure/config/env.schema.js";
import type { AppLogger } from "../lib/logger.js";

const { exitSpy } = vi.hoisted(() => ({ exitSpy: vi.fn() }));

vi.mock("./shutdown-coordinator.js", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("./shutdown-coordinator.js")>();
  return {
    ...mod,
    createShutdownCoordinator: (
      drain: () => Promise<void>,
      options?: Parameters<typeof mod.createShutdownCoordinator>[1],
    ) => mod.createShutdownCoordinator(drain, { ...options, exit: exitSpy }),
  };
});

const envStub = { PORT: 3000, API_HOST: "127.0.0.1" } as EnvConfig;

const loggerStub = (): AppLogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
});

interface NestAppStub {
  app: INestApplication;
  listenMock: Mock<() => Promise<void>>;
  closeMock: Mock<() => Promise<void>>;
}

const appStub = (): NestAppStub => {
  const expressInstance = { set: vi.fn() };
  const listenMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const closeMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const app = {
    close: closeMock,
    listen: listenMock,
    getHttpAdapter: () => ({ getInstance: () => expressInstance }),
  } as unknown as INestApplication;
  return { app, listenMock, closeMock };
};

vi.mock("../infrastructure/config/env.schema.js", () => ({
  validateEnv: () => envStub,
}));

interface CreatedApp {
  app: INestApplication;
  logger: AppLogger;
}
const createNestAppMock = vi.fn<() => Promise<CreatedApp>>();
vi.mock("./nest-app.js", () => ({ createNestApp: createNestAppMock }));

interface PipelineResult {
  shutdownRateLimitStore: () => Promise<void>;
  [key: string]: unknown;
}
const configureHttpPipelineMock = vi.fn<() => Promise<PipelineResult>>();
vi.mock("./http-pipeline.js", () => ({
  configureHttpPipeline: configureHttpPipelineMock,
}));

const createAppServicesMock = vi
  .fn<() => Record<string, unknown>>()
  .mockReturnValue({});
vi.mock("./app-services.js", () => ({
  createAppServices: createAppServicesMock,
}));

vi.mock("./api-ingress.js", () => ({ mountApiIngress: vi.fn() }));
vi.mock("./auth-ingress.js", () => ({ mountAuthIngress: vi.fn() }));
vi.mock("../infrastructure/bullmq/bull-board.module.js", () => ({
  mountBullBoard: vi.fn(),
}));
interface RegisteredCoordinator {
  request: (cause: "signal" | "fatal") => void;
}
const registerProcessErrorHandlersMock =
  vi.fn<(logger: AppLogger, coordinator: RegisteredCoordinator) => void>();
vi.mock("./process-error-handlers.js", () => ({
  registerProcessErrorHandlers: registerProcessErrorHandlersMock,
}));
const shutdownOtelMock = vi
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
vi.mock("../infrastructure/otel/otel.bootstrap.js", () => ({
  shutdownOtel: shutdownOtelMock,
}));
const shutdownSentryMock = vi
  .fn<(timeoutMs: number) => Promise<void>>()
  .mockResolvedValue(undefined);
vi.mock("./sentry-bootstrap.js", () => ({
  shutdownSentry: shutdownSentryMock,
}));

const signalHandlers = new Map<string, () => void>();
vi.spyOn(process, "on").mockImplementation(
  (event: string | symbol, handler: (...args: never[]) => void) => {
    if (event === "SIGTERM" || event === "SIGINT")
      signalHandlers.set(event, handler);
    return process;
  },
);

const { bootstrapApi } = await import("./api-bootstrap.js");

const pipelineResult = (
  overrides: Partial<PipelineResult> = {},
): PipelineResult => ({
  authLimiter: {},
  trpcLimiter: {},
  vitalsLimiter: {},
  feedbackLimiter: {},
  shutdownRateLimitStore: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  ...overrides,
});

const otelDecision = { enabled: false } as never;

describe("bootstrapApi startup drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signalHandlers.clear();
  });

  it("registers signal handlers before app.listen", async () => {
    const { app, listenMock } = appStub();
    const logger = loggerStub();
    createNestAppMock.mockResolvedValue({ app, logger });
    let signalArmedBeforeListen = false;
    listenMock.mockImplementation(() => {
      signalArmedBeforeListen = signalHandlers.has("SIGTERM");
      return Promise.resolve();
    });
    configureHttpPipelineMock.mockResolvedValue(pipelineResult());

    await bootstrapApi(otelDecision);

    expect(signalArmedBeforeListen).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("listening"),
    );
  });

  it("drains acquired resources once and exits 1 when the pipeline fails", async () => {
    const { app, closeMock } = appStub();
    const logger = loggerStub();
    createNestAppMock.mockResolvedValue({ app, logger });
    configureHttpPipelineMock.mockRejectedValue(
      new Error("rate-limit Redis connect failed"),
    );

    await bootstrapApi(otelDecision);
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(shutdownOtelMock).toHaveBeenCalledTimes(1);
    expect(shutdownSentryMock).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("listening"),
    );
    expect(registerProcessErrorHandlersMock).toHaveBeenCalledTimes(1);
    const [registeredLogger, registeredCoordinator] =
      registerProcessErrorHandlersMock.mock.calls[0] ?? [];
    expect(registeredLogger).toBe(logger);
    expect(registeredCoordinator?.request).toBeTypeOf("function");
  });

  it("drains acquired resources once and exits 1 when listen fails", async () => {
    const { app, listenMock, closeMock } = appStub();
    const logger = loggerStub();
    createNestAppMock.mockResolvedValue({ app, logger });
    listenMock.mockRejectedValue(new Error("EADDRINUSE"));
    const pipeline = pipelineResult();
    configureHttpPipelineMock.mockResolvedValue(pipeline);

    await bootstrapApi(otelDecision);
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(pipeline.shutdownRateLimitStore).toHaveBeenCalledTimes(1);
    expect(shutdownOtelMock).toHaveBeenCalledTimes(1);
  });

  it("SIGTERM during pending startup drains, skips listening log, exits once", async () => {
    const { app, listenMock, closeMock } = appStub();
    const logger = loggerStub();
    createNestAppMock.mockResolvedValue({ app, logger });
    configureHttpPipelineMock.mockImplementation(() => {
      // Signal lands while the pipeline stage is still pending.
      signalHandlers.get("SIGTERM")?.();
      return Promise.resolve(pipelineResult());
    });

    await bootstrapApi(otelDecision);
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(listenMock).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("listening"),
    );
  });

  it("SIGTERM after createNestApp acquisition closes that app exactly once", async () => {
    const { app, closeMock } = appStub();
    const logger = loggerStub();
    createNestAppMock.mockImplementation(() => {
      signalHandlers.get("SIGTERM")?.();
      return Promise.resolve({ app, logger });
    });
    configureHttpPipelineMock.mockResolvedValue(pipelineResult());

    await bootstrapApi(otelDecision);
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));

    // Once — either by the in-flight drain after arming, or by the startup
    // boundary's orphan close. Never twice.
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(configureHttpPipelineMock).not.toHaveBeenCalled();
  });
});
