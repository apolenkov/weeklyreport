"use client";

import type {
  LeadVelocityOutput,
  PeriodComparisonOutput,
  TrafficLightHistoryOutput,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import { latestPeriodPair } from "../../../../lib/analytics-periods";
import { deriveTrendsWindow } from "../../../../lib/trends-window";
import { useTRPC } from "../../../../lib/trpc-context";

/**
 * /reports/trends page.
 *
 * Client component because the existing tRPC seam in this app uses
 * `useTRPC()` from a React context provider (apps/web/src/lib/trpc-context.ts).
 * The layout gate at apps/web/src/app/(app)/reports/layout.tsx already
 * permits all four authenticated roles — this page inherits that.
 *
 * Recharts-based chart components are loaded via next/dynamic with
 * ssr:false so SSR does not crash on ResizeObserver.
 */

const TrafficLightHistoryChart = dynamic(
  () =>
    import("../../../../features/analytics/ui/traffic-light-history.chart").then(
      (m) => m.TrafficLightHistoryChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const LeadVelocityChart = dynamic(
  () =>
    import("../../../../features/analytics/ui/lead-velocity.chart").then(
      (m) => m.LeadVelocityChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const PeriodComparisonChart = dynamic(
  () =>
    import("../../../../features/analytics/ui/period-comparison.chart").then(
      (m) => m.PeriodComparisonChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-md bg-muted/50" />;
}

function isTrafficLightHistoryOutput(
  value: unknown,
): value is TrafficLightHistoryOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { periods?: unknown }).periods) &&
    Array.isArray((value as { rows?: unknown }).rows)
  );
}

function isLeadVelocityOutput(value: unknown): value is LeadVelocityOutput {
  return Array.isArray(value);
}

function isPeriodComparisonOutput(
  value: unknown,
): value is PeriodComparisonOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { rows?: unknown }).rows)
  );
}

export default function TrendsPage() {
  const trpc = useTRPC();
  // Anchor the window on the current date instead of pinning absolute calendar
  // bounds: the seed generates period-end dates relative to the run date and
  // real reports keep advancing, so a fixed window eventually excludes every
  // row and empties the charts.
  const { periodFrom, periodTo } = deriveTrendsWindow(new Date());
  const history = useQuery(
    trpc.analytics.trafficLightHistory.queryOptions({
      periodFrom,
      periodTo,
    }),
  );
  const velocity = useQuery(
    trpc.analytics.leadVelocity.queryOptions({
      periodFrom,
      periodTo,
    }),
  );
  // Compare the two most recent periods rather than fixed dates: the seed
  // generates period-end dates relative to the run date, so any pinned pair
  // goes stale and the chart renders empty. `periods` arrives ascending, so
  // the last two entries are the latest pair.
  const historyData = isTrafficLightHistoryOutput(history.data)
    ? history.data
    : undefined;
  const periodPair = latestPeriodPair(historyData?.periods ?? []);
  const comparison = useQuery({
    ...trpc.analytics.periodComparison.queryOptions({
      periodA: periodPair?.periodA ?? periodFrom,
      periodB: periodPair?.periodB ?? periodTo,
    }),
    enabled: periodPair !== null,
  });

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8"
    >
      <h1 className="text-2xl font-semibold">Trends</h1>

      <section aria-labelledby="trends-history-heading">
        <h2 id="trends-history-heading" className="mb-3 text-lg font-medium">
          Traffic-light history
        </h2>
        {history.isLoading ? (
          <ChartSkeleton />
        ) : historyData ? (
          <TrafficLightHistoryChart {...historyData} />
        ) : null}
      </section>

      <section aria-labelledby="trends-velocity-heading">
        <h2 id="trends-velocity-heading" className="mb-3 text-lg font-medium">
          Lead velocity
        </h2>
        {velocity.isLoading ? (
          <ChartSkeleton />
        ) : isLeadVelocityOutput(velocity.data) ? (
          <LeadVelocityChart rows={velocity.data} />
        ) : null}
      </section>

      <section aria-labelledby="trends-comparison-heading">
        <h2 id="trends-comparison-heading" className="mb-3 text-lg font-medium">
          Period comparison
        </h2>
        {comparison.isLoading ? (
          <ChartSkeleton />
        ) : isPeriodComparisonOutput(comparison.data) ? (
          <PeriodComparisonChart {...comparison.data} />
        ) : null}
      </section>
    </main>
  );
}
