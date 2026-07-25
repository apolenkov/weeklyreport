// MUST be the first runtime import in main.ts so the SDK monkey-patches http
// before Nest/Express/Prisma load it. Unset OTEL_EXPORTER_OTLP_ENDPOINT leaves
// the SDK off; start errors are non-fatal so a down collector never blocks boot.

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
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { SentryPropagator } from "@sentry/opentelemetry";

export type OtelBootstrapResult =
  | {
      started: true;
      reason: "enabled";
      samplingRatio: number;
      endpoint: string;
    }
  | { started: false; reason: "disabled-flag" }
  | { started: false; reason: "no-endpoint" };

const DEFAULT_TRACES_SAMPLING_RATIO = 1.0;

/**
 * Decide Otel Bootstrap.
 * @param env - The env argument.
 */
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
  const ratio = Number(
    env.OTEL_TRACES_SAMPLER_ARG ?? String(DEFAULT_TRACES_SAMPLING_RATIO),
  );
  const samplingRatio =
    Number.isFinite(ratio) && ratio >= 0 && ratio <= 1
      ? ratio
      : DEFAULT_TRACES_SAMPLING_RATIO;
  return { started: true, reason: "enabled", samplingRatio, endpoint };
}

// CompositePropagator.extract is left-to-right; last match wins. W3C last so
// traceparent beats sentry-trace; SentryPropagator bridges sentry-trace-only.
/**
 * Create Trace Context Propagator.
 */
export function createTraceContextPropagator(): CompositePropagator {
  return new CompositePropagator({
    propagators: [new SentryPropagator(), new W3CTraceContextPropagator()],
  });
}

// eslint-disable-next-line no-restricted-syntax -- OTel SDK handle is assigned during bootstrap and read during shutdown; module-level lifecycle state is intentional.
let sdk: NodeSDK | null = null;
// eslint-disable-next-line no-restricted-syntax -- OTel logger provider handle is assigned during bootstrap and read during shutdown; module-level lifecycle state is intentional.
let loggerProvider: LoggerProvider | null = null;

function shutdownOtel(): void {
  void Promise.all([sdk?.shutdown(), loggerProvider?.shutdown()]).catch(
    (error: unknown) => {
      process.stderr.write(
        `[otel] shutdown error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    },
  );
}

function registerShutdownHandler(signal: NodeJS.Signals): void {
  if (!process.listeners(signal).includes(shutdownOtel)) {
    process.once(signal, shutdownOtel);
  }
}

/**
 * Start the OpenTelemetry SDK, or record why it stayed off.
 * @param env - Environment the endpoint and service identity are read from.
 */
// eslint-disable-next-line sonarjs/no-invariant-returns -- returns the bootstrap decision object from every path by design (disabled vs started); one semantic return value, not an accidental invariant
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
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? "customreport-api",
    [ATTR_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION ?? "dev",
  });

  sdk = new NodeSDK({
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
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${base}/v1/logs` }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  // Best-effort shutdown on SIGTERM — flush pending spans + logs within ~5s.
  registerShutdownHandler("SIGTERM");
  registerShutdownHandler("SIGINT");

  return decision;
}
