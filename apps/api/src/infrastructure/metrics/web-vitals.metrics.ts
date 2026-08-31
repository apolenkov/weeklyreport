import { Histogram } from "@prometheus-io/client";

import { metricsRegistry } from "./metrics.registry.js";

const metricBuckets = (values: readonly string[]): number[] =>
  values.map(Number);
const LCP_BUCKETS = metricBuckets([
  "100",
  "250",
  "500",
  "1000",
  "2000",
  "4000",
  "8000",
]);
const CLS_BUCKETS = metricBuckets(["0.05", "0.1", "0.25", "0.5", "1", "2"]);
const FCP_BUCKETS = metricBuckets([
  "200",
  "500",
  "1000",
  "1800",
  "3000",
  "5000",
  "8000",
]);
const INP_BUCKETS = metricBuckets([
  "50",
  "100",
  "200",
  "300",
  "500",
  "800",
  "1200",
]);
const TTFB_BUCKETS = metricBuckets([
  "100",
  "250",
  "500",
  "800",
  "1200",
  "1800",
  "3000",
]);

// Histograms, not gauges, so the dashboard derives p75/p95 via `histogram_quantile`
// instead of a last-write-wins point. Buckets bracket the web-vitals
// good/needs-improvement/poor thresholds: raw ms per vital, CLS an unscaled ~0–1 score.

export const webVitalLcp = new Histogram({
  name: "web_vital_lcp",
  help: "Largest Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: LCP_BUCKETS,
  registers: [metricsRegistry],
});

export const webVitalCls = new Histogram({
  name: "web_vital_cls",
  help: "Cumulative Layout Shift (score)",
  labelNames: ["navigation_type"] as const,
  buckets: CLS_BUCKETS,
  registers: [metricsRegistry],
});

export const webVitalFcp = new Histogram({
  name: "web_vital_fcp",
  help: "First Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: FCP_BUCKETS,
  registers: [metricsRegistry],
});

export const webVitalInp = new Histogram({
  name: "web_vital_inp",
  help: "Interaction to Next Paint (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: INP_BUCKETS,
  registers: [metricsRegistry],
});

export const webVitalTtfb = new Histogram({
  name: "web_vital_ttfb",
  help: "Time to First Byte (ms)",
  labelNames: ["navigation_type"] as const,
  buckets: TTFB_BUCKETS,
  registers: [metricsRegistry],
});
