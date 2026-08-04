// @vitest-environment node

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

type DynamicCall = Readonly<{
  loader: () => Promise<unknown>;
  options: Readonly<{ loading?: () => ReactNode; ssr?: boolean }>;
}>;

const dynamicCalls = vi.hoisted(() => [] as DynamicCall[]);
const chartComponents = vi.hoisted(() => ({
  history: () => null,
  velocity: () => null,
  comparison: () => null,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: DynamicCall["loader"], options: DynamicCall["options"]) => {
    dynamicCalls.push({ loader, options });
    return () => null;
  },
}));
vi.mock(
  "../../../../features/analytics/ui/traffic-light-history.chart",
  () => ({ TrafficLightHistoryChart: chartComponents.history }),
);
vi.mock("../../../../features/analytics/ui/lead-velocity.chart", () => ({
  LeadVelocityChart: chartComponents.velocity,
}));
vi.mock("../../../../features/analytics/ui/period-comparison.chart", () => ({
  PeriodComparisonChart: chartComponents.comparison,
}));

beforeAll(async () => {
  await import("./page");
});

describe("Trends chunk loading", () => {
  it.each([
    ["traffic-light history", 0, chartComponents.history],
    ["lead velocity", 1, chartComponents.velocity],
    ["period comparison", 2, chartComponents.comparison],
  ] as const)(
    "loads the %s chart from its concrete module",
    async (_name, index, chart) => {
      await expect(dynamicCalls[index]?.loader()).resolves.toBe(chart);
    },
  );

  it("configures every chart as client-only with a local skeleton", () => {
    expect(dynamicCalls).toHaveLength(3);
    dynamicCalls.forEach(({ options }) => {
      expect(options.ssr).toBe(false);
      expect(options.loading).toBeTypeOf("function");
      const loading = options.loading as () => ReactNode;
      expect(renderToStaticMarkup(loading())).toContain("animate-pulse");
    });
  });
});
