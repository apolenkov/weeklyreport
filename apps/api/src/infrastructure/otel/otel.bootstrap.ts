// Loaded after Sentry but before API composition so the SDK patches HTTP before
// Nest/Express/Prisma. Collector absence or start failure never blocks boot.

import { format } from "node:url";

import { propagation } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
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
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_URL_FULL,
  ATTR_URL_QUERY,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { SentryPropagator } from "@sentry/opentelemetry";

import { errorMessage } from "../../lib/error-message.js";
import { parseOtlpEndpoint } from "../../lib/otlp-endpoint.js";

export type OtelBootstrapResult =
  | {
      started: true;
      reason: "enabled";
      samplingRatio: number;
      endpoint: string;
    }
  | { started: false; reason: "disabled-flag" }
  | { started: false; reason: "no-endpoint" }
  | { started: false; reason: "start-failed" };

const DEFAULT_TRACES_SAMPLING_RATIO = 1.0;

// env.schema declares OTEL_SERVICE_NAME/_VERSION optional, so the bootstrap
// supplies the service identity spans are attributed to when they are unset.
const DEFAULT_SERVICE_NAME = "weeklyreport-api";
const DEFAULT_SERVICE_VERSION = "dev";

const samplingRatioFor = (rawRatio: string | undefined): number => {
  if (rawRatio?.trim().length === 0)
    throw new Error("OTEL_TRACES_SAMPLER_ARG must not be blank");
  const samplingRatio =
    rawRatio === undefined ? DEFAULT_TRACES_SAMPLING_RATIO : Number(rawRatio);
  if (!Number.isFinite(samplingRatio) || samplingRatio < 0 || samplingRatio > 1)
    throw new Error(
      `OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1; received ${JSON.stringify(rawRatio)}`,
    );
  return samplingRatio;
};

export function decideOtelBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  if ((env.OTEL_SDK_DISABLED ?? "").toLowerCase() === "true") {
    return { started: false, reason: "disabled-flag" };
  }
  // Same contract as env.schema: whitespace means unset, a malformed
  // nonblank endpoint throws before any exporter is constructed.
  const endpoint = parseOtlpEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT);
  if (endpoint === undefined) {
    return { started: false, reason: "no-endpoint" };
  }
  const samplingRatio = samplingRatioFor(env.OTEL_TRACES_SAMPLER_ARG);
  return { started: true, reason: "enabled", samplingRatio, endpoint };
}

// CompositePropagator.extract is left-to-right; last match wins. W3C last so
// traceparent beats sentry-trace; SentryPropagator bridges sentry-trace-only.
export function createTraceContextPropagator(): CompositePropagator {
  return new CompositePropagator({
    propagators: [new SentryPropagator(), new W3CTraceContextPropagator()],
  });
}

class OtelLifecycle {
  private handles: {
    readonly sdk: NodeSDK | null;
    readonly loggerProvider: LoggerProvider | null;
  } = { sdk: null, loggerProvider: null };

  install(sdk: NodeSDK, loggerProvider: LoggerProvider): void {
    this.handles = { sdk, loggerProvider };
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.handles.sdk?.shutdown(),
      this.handles.loggerProvider?.shutdown(),
    ]);
  }
}

const otelLifecycle = new OtelLifecycle();

export const shutdownOtel = (): Promise<void> => otelLifecycle.shutdown();

// Starts the OpenTelemetry SDK, or records why it stayed off.
export function startOtel(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  // Always register (even when export is off) so BullMQ inject/extract speaks
  // W3C traceparent, not the default no-op. SDK start re-registers the same
  // composite via textMapPropagator.
  propagation.setGlobalPropagator(createTraceContextPropagator());

  const decision = decideOtelBootstrap(env);
  if (!decision.started) {
    return decision;
  }

  const base = decision.endpoint.replace(/\/$/, "");
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION ?? DEFAULT_SERVICE_VERSION,
  });

  const sdk = new NodeSDK({
    resource,
    // ParentBased keeps a sampled-in parent; a bare ratio re-dices every span
    // and can drop the api hop from a browser-kept trace.
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(decision.samplingRatio),
    }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    // Browser→api shared trace id; W3C-wins precedence in createTraceContextPropagator.
    textMapPropagator: createTraceContextPropagator(),
    instrumentations: [
      // Start hooks also cover native request errors that precede requestHook.
      new HttpInstrumentation({
        startIncomingSpanHook: (request) =>
          request.url?.includes("?") ? { [ATTR_URL_QUERY]: "" } : {},
        startOutgoingSpanHook: (request) => ({
          [ATTR_URL_FULL]: format({
            protocol: request.protocol ?? "http:",
            hostname: request.hostname || request.host || "localhost",
            port: request.port,
            pathname: request.path?.startsWith("/")
              ? request.path.split("?")[0]
              : (URL.parse(request.path ?? "/", "http://localhost")?.pathname ??
                "/"),
            slashes: true,
          }),
        }),
      }),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  try {
    sdk.start();
  } catch (error) {
    // Non-fatal: api should still boot if the collector is unreachable. The
    // SDK failed to start, so the reported result must not claim "started",
    // and no log provider / shutdown handler may be registered for it.
    process.stderr.write(`[otel] start failed: ${errorMessage(error)}\n`);
    return { started: false, reason: "start-failed" };
  }

  // Register global log provider so AppLogger can forward logs to Loki via OTLP.
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${base}/v1/logs` }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
  otelLifecycle.install(sdk, loggerProvider);

  return decision;
}
