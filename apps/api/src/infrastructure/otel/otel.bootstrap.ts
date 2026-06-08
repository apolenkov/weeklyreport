/**
 * 37-01 — OpenTelemetry bootstrap.
 *
 * Wires the Node SDK with OTLP/HTTP export + HTTP/Express/Prisma
 * instrumentations. MUST be the first runtime import in main.ts so the
 * SDK can monkey-patch the http module before NestJS / Express / Prisma
 * pull it in.
 *
 * Disabled by default (no exporter endpoint configured). Three env knobs:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT  - traces shipped to {endpoint}/v1/traces;
 *                                  unset → SDK doesn't start
 *   OTEL_SDK_DISABLED=true       - hard kill switch (overrides everything)
 *   OTEL_TRACES_SAMPLER_ARG=0.1  - probability sampler ratio (default 0.1)
 *
 * The `start()` call is synchronous; shutdown on SIGTERM flushes pending
 * spans. Errors during start are non-fatal — the api boots even if the
 * collector is unreachable, just without traces.
 */

import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

export type OtelBootstrapResult =
  | {
      started: true;
      reason: "enabled";
      samplingRatio: number;
      endpoint: string;
    }
  | { started: false; reason: "disabled-flag" }
  | { started: false; reason: "no-endpoint" };

export function decideOtelBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  if ((env.OTEL_SDK_DISABLED ?? "").toLowerCase() === "true") {
    return { started: false, reason: "disabled-flag" };
  }
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return { started: false, reason: "no-endpoint" };
  }
  const ratio = Number(env.OTEL_TRACES_SAMPLER_ARG ?? "0.1");
  const samplingRatio =
    Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 0.1;
  return { started: true, reason: "enabled", samplingRatio, endpoint };
}

let sdk: NodeSDK | null = null;
let loggerProvider: LoggerProvider | null = null;

export function startOtel(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  const decision = decideOtelBootstrap(env);
  if (!decision.started) {
    return decision;
  }

  const base = decision.endpoint.replace(/\/$/, "");
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? "customreport-api",
    [ATTR_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION ?? "dev",
  });

  sdk = new NodeSDK({
    resource,
    sampler: new TraceIdRatioBasedSampler(decision.samplingRatio),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  try {
    sdk.start();
  } catch (error) {
    // Non-fatal: api should still boot if the collector is unreachable.
    process.stderr.write(
      `[otel] start failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }

  // Register global log provider so AppLogger can forward logs to Loki via OTLP.
  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${base}/v1/logs` }),
      ),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  // Best-effort shutdown on SIGTERM — flush pending spans + logs within ~5s.
  const shutdown = () => {
    void Promise.all([sdk?.shutdown(), loggerProvider?.shutdown()]).catch(
      (error: unknown) => {
        process.stderr.write(
          `[otel] shutdown error: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      },
    );
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return decision;
}

export function shutdownOtel(): Promise<void> {
  return Promise.all([
    sdk?.shutdown() ?? Promise.resolve(),
    loggerProvider?.shutdown() ?? Promise.resolve(),
  ]).then(() => undefined);
}
