"use client";

import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { useTRPC } from "../../lib/trpc-context";

/**
 * Phase 52 (UFB-054) — in-app KPI card backed by `telemetry.summary`.
 *
 * Renders six headline numbers + a 4-week on-time sparkline so the
 * leadership audience (head + admin + viewer) sees the same product
 * KPIs as the Grafana «Product KPIs» dashboard without leaving the app.
 *
 * Gated by tRPC `leadershipProcedure` (lead role denied). When the
 * session is in lead role we render nothing — calling the procedure
 * would 403 and we don't want a misleading "loading" skeleton.
 *
 * Caller responsibility (e.g. DashboardPage) decides where to place
 * this card; the component itself owns its data-fetching, schema, and
 * accessibility labelling.
 */
interface ProductKpiCardProps {
  readonly role?: "lead" | "head" | "admin" | "viewer" | null;
}

export function ProductKpiCard({ role }: ProductKpiCardProps) {
  const trpc = useTRPC();
  // Skip the query for `lead` role — leadershipProcedure would 403 and
  // the empty result is meaningless to a lead anyway. `enabled` gates
  // the call cleanly; React Query won't fire the request until the role
  // is in the leadership set.
  const isLeadership = role === "head" || role === "admin" || role === "viewer";
  const summaryQ = useQuery({
    ...trpc.telemetry.summary.queryOptions(),
    enabled: isLeadership,
  });

  if (!isLeadership) return null;

  if (summaryQ.isLoading) {
    return (
      <section
        aria-label="Product KPIs"
        data-testid="product-kpi-card"
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
      >
        <h2 className="mb-2 text-base font-semibold text-[var(--color-foreground)]">
          Product KPIs
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Loading telemetry…
        </p>
      </section>
    );
  }

  if (summaryQ.isError || !summaryQ.data) {
    return (
      <section
        aria-label="Product KPIs"
        data-testid="product-kpi-card"
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
      >
        <h2 className="mb-2 text-base font-semibold text-[var(--color-foreground)]">
          Product KPIs
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Failed to load telemetry.
        </p>
      </section>
    );
  }

  const s = summaryQ.data;
  const onTimePct =
    s.onTimeRatio === null ? "—" : `${Math.round(s.onTimeRatio * 100)}%`;
  // Recharts wants `{x,y}` rows; map sparkline → indexed points.
  const sparklineRows = s.sparkline.map((value, idx) => ({
    period: idx + 1,
    onTime: Math.round(value * 100),
  }));

  return (
    <section
      aria-label="Product KPIs"
      data-testid="product-kpi-card"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
    >
      <h2 className="mb-4 text-base font-semibold text-[var(--color-foreground)]">
        Product KPIs
      </h2>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Reports this period" value={s.reportsThisPeriod} />
        <Stat label="On-time ratio" value={onTimePct} />
        <Stat label="Active leads" value={s.activeLeads} />
        <Stat label="Late sections" value={s.lateSections} />
        <Stat label="Pending reopens" value={s.pendingReopens} />
        <Stat label="PDF exports (7d)" value={s.pdfExportsLast7d} />
      </div>
      {sparklineRows.length > 0 && (
        <div
          role="img"
          className="mt-4 h-16 w-full"
          aria-label="On-time ratio sparkline over the last 4 periods"
        >
          {/* aria-hidden + tabIndex={-1} suppresses the SVG tabindex=0/focusable="true"
              that Recharts injects by default — the chart has no interactive value
              for keyboard users so we remove it from the focus order entirely (D-35). */}
          <div aria-hidden="true" tabIndex={-1} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <LineChart
                data={sparklineRows}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                // Recharts injects a focusable keyboard layer by default; this
                // decorative sparkline lives in an aria-hidden wrapper, so the
                // layer would be a focusable descendant of aria-hidden content
                // (axe aria-hidden-focus). Disable it.
                accessibilityLayer={false}
              >
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  formatter={(value) => [`${String(value)}%`, "on-time"]}
                  labelFormatter={(label) => `Period ${String(label)}`}
                />
                <Line
                  type="monotone"
                  dataKey="onTime"
                  stroke="var(--color-starbucks-accent, #00754A)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-3">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-foreground)]">
        {value}
      </p>
    </div>
  );
}
