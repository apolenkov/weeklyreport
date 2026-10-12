import type { INestApplication } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import type { EnvConfig } from "../infrastructure/config/env.schema";
import { SentryExceptionFilter } from "../infrastructure/filters/sentry-exception.filter";
import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap";
import { APP_LOGGER } from "../lib/audit-logger";
import type { AppLogger } from "../lib/logger";
import { createAppLogger } from "../lib/logger";
import { NestAppLoggerAdapter } from "../lib/nest-app-logger.adapter";
import { logOtelDecision } from "./otel-decision-log";

// The pre-bootstrap logger has no CLS yet, so it is routed through
// NestAppLoggerAdapter and swapped for the container-resolved AppLogger as soon
// as the app exists — one file sink, never a second concurrent writer.
export async function createNestApp(deps: {
  env: EnvConfig;
  otelDecision: OtelBootstrapResult;
}): Promise<{ app: INestApplication; logger: AppLogger }> {
  const { env, otelDecision } = deps;

  const preBootLogger = createAppLogger({
    service: "weeklyreport-api",
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
  });
  const nestLoggerAdapter = new NestAppLoggerAdapter(preBootLogger);

  preBootLogger.info("bootstrap starting");

  try {
    // abortOnError:false — a provider init failure must reject this promise
    // so the bootstrap failure boundary owns the exit, not process.abort.
    const app = await NestFactory.create(AppModule, {
      logger: nestLoggerAdapter,
      abortOnError: false,
    });

    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

    const logger = app.get<AppLogger>(APP_LOGGER);

    nestLoggerAdapter.setLogger(logger);
    logger.info("bootstrap started");
    logOtelDecision(logger, otelDecision);

    return { app, logger };
  } catch (error) {
    // The container logger never took over — flush the pre-boot logger once
    // so its buffered file sink is not lost with the failed startup.
    await preBootLogger.flush?.().catch(() => undefined);
    throw error;
  }
}
