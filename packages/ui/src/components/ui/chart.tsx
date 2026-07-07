"use client";

import { cn } from "@customreport/ui/lib/utils";
import type * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

/**
 * Minimal chart wrapper around recharts — Tailwind-friendly height/width
 * defaults and a styled Tooltip. A slimmer wrapper than shadcn-ui's full
 * Chart API: exposes the two primitives consumed by the trends page chart
 * components.
 */

// `ResponsiveContainer` seeds its first render from `initialDimension`, which
// defaults to {-1,-1}; with width/height="100%" that makes the very first
// paint compute a negative chart size and recharts logs a `width(-1)/height(-1)`
// warning until the ResizeObserver fires. `min*` props are CSS-only and do not
// feed that calculation, so we seed a positive initial dimension instead. The
// height matches the `h-64` wrapper (16rem = 256px at the 16px root font).
const CHART_INITIAL_DIMENSION = { width: 0, height: 256 } as const;

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
