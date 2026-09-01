"use client";

import { cn } from "@customreport/ui/lib/utils";
import type * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

// Seed positive dimensions until ResizeObserver reports the real container size.
const CHART_INITIAL_DIMENSION = { width: 800, height: 256 } as const;

/** Fixed-height chart viewport with positive dimensions on its first layout pass. */
export function ChartContainer({
  className,
  children,
  ...props
}: Readonly<
  Omit<React.ComponentProps<"div">, "children"> & {
    readonly children: React.ReactElement;
  }
>) {
  return (
    <div className={cn("h-64 w-full", className)} {...props}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={CHART_INITIAL_DIMENSION}
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Tooltip surface styled through chart-specific design tokens. */
export function ChartTooltip(
  props: Readonly<React.ComponentProps<typeof Tooltip>>,
) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        borderRadius: "var(--radius-chart-tooltip)",
        fontSize: "var(--font-size-chart-tooltip)",
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-border)",
      }}
    />
  );
}
