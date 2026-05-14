"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import type {
  LeadVelocityOutput,
  PeriodComparisonOutput,
  TrafficLightHistoryOutput,
} from "@customreport/shared";

import { useTRPC } from "../../../../lib/trpc-context";

/**
 * ANAL-04 (Phase 30-03): /reports/trends page.
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
    import("../../../../components/charts/traffic-light-history.chart").then(
      (m) => m.TrafficLightHistoryChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const LeadVelocityChart = dynamic(
  () =>
    import("../../../../components/charts/lead-velocity.chart").then(
      (m) => m.LeadVelocityChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const PeriodComparisonChart = dynamic(
  () =>
    import("../../../../components/charts/period-comparison.chart").then(
      (m) => m.PeriodComparisonChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-md bg-muted/50" />;
}

const PERIOD_FROM = "2026-01-01";
const PERIOD_TO = "2026-12-31";
const PERIOD_A = "2026-04-21";
const PERIOD_B = "2026-04-28";

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
  const history = useQuery(
    trpc.analytics.trafficLightHistory.queryOptions({
      periodFrom: PERIOD_FROM,
      periodTo: PERIOD_TO,
    }),
  );
  const velocity = useQuery(
    trpc.analytics.leadVelocity.queryOptions({
      periodFrom: PERIOD_FROM,
      periodTo: PERIOD_TO,
    }),
  );
  const comparison = useQuery(
    trpc.analytics.periodComparison.queryOptions({
      periodA: PERIOD_A,
      periodB: PERIOD_B,
    }),
  );

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
        ) : isTrafficLightHistoryOutput(history.data) ? (
          <TrafficLightHistoryChart {...history.data} />
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
