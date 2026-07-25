"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

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

function TrendsSection({
  headingId,
  title,
  isLoading,
  children,
}: {
  readonly headingId: string;
  readonly title: string;
  readonly isLoading: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-lg font-medium">
        {title}
      </h2>
      {isLoading ? <ChartSkeleton /> : children}
    </section>
  );
}

function useTrendsQueries() {
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

  return { history, historyData, velocity, comparison };
}

export default function TrendsPage() {
  const { history, historyData, velocity, comparison } = useTrendsQueries();

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8"
    >
      <h1 className="text-2xl font-semibold">Trends</h1>

      <TrendsSection
        headingId="trends-history-heading"
        title="Traffic-light history"
        isLoading={history.isLoading}
      >
        {historyData !== undefined ? (
          <TrafficLightHistoryChart {...historyData} />
        ) : null}
      </TrendsSection>

      <TrendsSection
        headingId="trends-velocity-heading"
        title="Lead velocity"
        isLoading={velocity.isLoading}
      >
        {velocity.data !== undefined ? (
          <LeadVelocityChart rows={velocity.data} />
        ) : null}
      </TrendsSection>

      <TrendsSection
        headingId="trends-comparison-heading"
        title="Period comparison"
        isLoading={comparison.isLoading}
      >
        {comparison.data !== undefined ? (
          <PeriodComparisonChart {...comparison.data} />
        ) : null}
      </TrendsSection>
    </main>
  );
}
