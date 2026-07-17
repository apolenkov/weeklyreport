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
 *   OTEL_TRACES_SAMPLER_ARG=1.0  - root-span probability sampler ratio
 *                                  (default 1.0), wrapped in ParentBased so a
 *                                  sampled-in parent trace is always honored
 *
 * The `start()` call is synchronous; shutdown on SIGTERM flushes pending
 * spans. Errors during start are non-fatal — the api boots even if the
 * collector is unreachable, just without traces.
 */

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

/**
 * correlate-errors-to-traces: composite propagator for browser→api trace
 * adoption. CompositePropagator.extract folds the propagators left-to-right,
 * so the LAST one that finds its header wins. W3C is placed last so its
 * `traceparent` wins when both headers are present; `SentryPropagator`
 * (which also carries baggage) bridges browser requests that send only
 * `sentry-trace`. Exported so the precedence is unit-tested against the real
 * CompositePropagator, not asserted by reading the array order.
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

// eslint-disable-next-line sonarjs/no-invariant-returns -- returns the bootstrap decision object from every path by design (disabled vs started); one semantic return value, not an accidental invariant
export function startOtel(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  // Register the W3C trace-context propagator globally and unconditionally —
  // even when the exporter is disabled — so the manual inject/extract on the
  // BullMQ enqueue->worker boundary always speaks W3C `traceparent`, not the
  // default no-op propagator. When the SDK starts it re-registers the same
  // composite via NodeSDK's `textMapPropagator`.
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
    // ParentBased so a sampled-in parent (e.g. a browser-originated trace)
    // is always kept at the api hop; only root spans consult the ratio.
    // A bare ratio sampler re-dices every span and can drop the api's span
    // from a trace the browser already decided to keep.
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(decision.samplingRatio),
    }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    // correlate-errors-to-traces: adopt the browser's trace id on inbound
    // requests so a browser-originated call shares one id with the api.
    // Replaces NodeSDK's default W3C trace+baggage propagator; see the
    // createTraceContextPropagator() doc for the W3C-wins precedence.
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
