"use client";

import { useQuery } from "@tanstack/react-query";

import {
  deriveTrendsWindow,
  latestPeriodPair,
} from "../../../../features/analytics";
import { LeadVelocityChart } from "../../../../features/analytics/ui/lead-velocity.chart";
import { PeriodComparisonChart } from "../../../../features/analytics/ui/period-comparison.chart";
import { TrafficLightHistoryChart } from "../../../../features/analytics/ui/traffic-light-history.chart";
import { TrendsSection } from "../../../../features/analytics/ui/trends-section";
import { useQueryErrorHandler } from "../../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";

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
  useQueryErrorHandler(history, {
    component: "TrendsPage",
    event: "analytics.traffic_light_history.load_failed",
    procedure: "analytics.trafficLightHistory",
  });
  useQueryErrorHandler(velocity, {
    component: "TrendsPage",
    event: "analytics.lead_velocity.load_failed",
    procedure: "analytics.leadVelocity",
  });
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
  useQueryErrorHandler(comparison, {
    component: "TrendsPage",
    event: "analytics.period_comparison.load_failed",
    procedure: "analytics.periodComparison",
  });

  return { history, historyData, velocity, comparison, periodPair };
}

type TrendsQueries = ReturnType<typeof useTrendsQueries>;

function TrafficLightTrendsSection({
  history,
  historyData,
}: Pick<TrendsQueries, "history" | "historyData">) {
  return (
    <TrendsSection
      headingId="trends-history-heading"
      title="Traffic-light history"
      isError={history.isError}
      isLoading={history.isLoading}
      isRetrying={history.isFetching}
      onRetry={() => {
        void history.refetch().catch(() => undefined);
      }}
    >
      {historyData !== undefined ? (
        <TrafficLightHistoryChart
          {...historyData}
          headingId="trends-history-heading"
        />
      ) : null}
    </TrendsSection>
  );
}

function LeadVelocityTrendsSection({
  velocity,
}: Pick<TrendsQueries, "velocity">) {
  return (
    <TrendsSection
      headingId="trends-velocity-heading"
      title="Lead velocity"
      isError={velocity.isError}
      isLoading={velocity.isLoading}
      isRetrying={velocity.isFetching}
      onRetry={() => {
        void velocity.refetch().catch(() => undefined);
      }}
    >
      {velocity.data !== undefined ? (
        <LeadVelocityChart
          rows={velocity.data}
          headingId="trends-velocity-heading"
        />
      ) : null}
    </TrendsSection>
  );
}

function PeriodComparisonTrendsSection({
  comparison,
  history,
  periodPair,
}: Pick<TrendsQueries, "comparison" | "history" | "periodPair">) {
  const retry = () => {
    if (history.isError) void history.refetch().catch(() => undefined);
    else void comparison.refetch().catch(() => undefined);
  };

  return (
    <TrendsSection
      headingId="trends-comparison-heading"
      title="Period comparison"
      emptyMessage={
        !history.isLoading && !history.isError && periodPair === null
          ? "At least two published periods are required for comparison."
          : undefined
      }
      isError={history.isError || comparison.isError}
      isLoading={history.isLoading || comparison.isLoading}
      isRetrying={history.isFetching || comparison.isFetching}
      onRetry={retry}
    >
      {comparison.data !== undefined && periodPair !== null ? (
        <PeriodComparisonChart {...comparison.data} {...periodPair} />
      ) : null}
    </TrendsSection>
  );
}

export default function TrendsPage() {
  const queries = useTrendsQueries();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8"
    >
      <h1 className="text-2xl font-semibold">Trends</h1>
      <TrafficLightTrendsSection {...queries} />
      <LeadVelocityTrendsSection velocity={queries.velocity} />
      <PeriodComparisonTrendsSection {...queries} />
    </main>
  );
}
