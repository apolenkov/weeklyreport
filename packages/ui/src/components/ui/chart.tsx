"use client";

import { cn } from "@customreport/ui/lib/utils";
import type * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

// Seed positive initialDimension so ResponsiveContainer does not paint width/height -1 (h-64 = 256).
const CHART_INITIAL_DIMENSION = { width: 0, height: 256 } as const;

/**
 * Fixed-height ResponsiveContainer shell; seeds initialDimension so recharts does not paint -1 size.
 * @param props - The props argument.
 */
export function ChartContainer({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  readonly children: React.ReactElement;
}) {
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

/**
 * Recharts Tooltip pre-styled with theme CSS variables (card/border).
 * @param props - Recharts Tooltip props; a caller-supplied `contentStyle` is
 * overridden by the theme tokens.
 */
export function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        borderRadius: 6,
        fontSize: 12,
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-border)",
      }}
    />
  );
}
