"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import { latestPeriodPair } from "../../../../lib/analytics-periods";
import { deriveTrendsWindow } from "../../../../lib/trends-window";
import { useTRPC } from "../../../../lib/trpc-context";

// Charts load with ssr:false — Recharts needs ResizeObserver (browser-only).
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

export default function TrendsPage() {
  const trpc = useTRPC();
  // Window relative to now — seed period-ends and real reports keep advancing.
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
  // Latest two periods (ascending list); fixed dates go stale against the seed.
  const historyData = history.data;
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
        ) : historyData !== undefined ? (
          <TrafficLightHistoryChart {...historyData} />
        ) : null}
      </section>

      <section aria-labelledby="trends-velocity-heading">
        <h2 id="trends-velocity-heading" className="mb-3 text-lg font-medium">
          Lead velocity
        </h2>
        {velocity.isLoading ? (
          <ChartSkeleton />
        ) : velocity.data !== undefined ? (
          <LeadVelocityChart rows={velocity.data} />
        ) : null}
      </section>

      <section aria-labelledby="trends-comparison-heading">
        <h2 id="trends-comparison-heading" className="mb-3 text-lg font-medium">
          Period comparison
        </h2>
        {comparison.isLoading ? (
          <ChartSkeleton />
        ) : comparison.data !== undefined ? (
          <PeriodComparisonChart {...comparison.data} />
        ) : null}
      </section>
    </main>
  );
}
