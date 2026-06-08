import { Gauge } from "prom-client";

import { metricsRegistry } from "./metrics.registry.js";

export const webVitalLcp = new Gauge({
  name: "web_vital_lcp",
  help: "Largest Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  registers: [metricsRegistry],
});

export const webVitalCls = new Gauge({
  name: "web_vital_cls",
  help: "Cumulative Layout Shift (score × 1000)",
  labelNames: ["navigation_type"] as const,
  registers: [metricsRegistry],
});

export const webVitalFcp = new Gauge({
  name: "web_vital_fcp",
  help: "First Contentful Paint (ms)",
  labelNames: ["navigation_type"] as const,
  registers: [metricsRegistry],
});

export const webVitalInp = new Gauge({
  name: "web_vital_inp",
  help: "Interaction to Next Paint (ms)",
  labelNames: ["navigation_type"] as const,
  registers: [metricsRegistry],
});

export const webVitalTtfb = new Gauge({
  name: "web_vital_ttfb",
  help: "Time to First Byte (ms)",
  labelNames: ["navigation_type"] as const,
  registers: [metricsRegistry],
});
