import { Histogram } from "prom-client";

import { metricsRegistry } from "./metrics.registry.js";

/**
 * Web-vitals instruments. Each vital is a {@link Histogram} (not a gauge) so
 * `/metrics` exposes a real latency distribution — the dashboard computes
 * p75/p95 via `histogram_quantile` instead of reading a last-write-wins point.
 * The metric names and the single `navigation_type` label are unchanged from
 * the former gauges, so only the panel query moves, not the series identity.
 *
 * Buckets bracket the web-vitals good/needs-improvement/poor thresholds for
 * each vital. The millisecond vitals (LCP/FCP/INP/TTFB) carry the raw value the
 * `web-vitals` library emits; CLS is an unscaled layout-shift score (typically
 * 0–1), so its buckets are small fractional boundaries matching that unit.
 */

export const webVitalLcp = new Histogram({
  name: "web_vital_lcp",
  help: "Largest Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: [100, 250, 500, 1000, 2000, 4000, 8000],
  registers: [metricsRegistry],
});

export const webVitalCls = new Histogram({
  name: "web_vital_cls",
  help: "Cumulative Layout Shift (score)",
  labelNames: ["navigation_type"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry],
});

export const webVitalFcp = new Histogram({
  name: "web_vital_fcp",
  help: "First Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: [200, 500, 1000, 1800, 3000, 5000, 8000],
  registers: [metricsRegistry],
});

export const webVitalInp = new Histogram({
  name: "web_vital_inp",
  help: "Interaction to Next Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: [50, 100, 200, 300, 500, 800, 1200],
  registers: [metricsRegistry],
});

export const webVitalTtfb = new Histogram({
  name: "web_vital_ttfb",
  help: "Time to First Byte (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: [100, 250, 500, 800, 1200, 1800, 3000],
  registers: [metricsRegistry],
});
