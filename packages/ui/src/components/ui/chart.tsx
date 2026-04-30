'use client';

import * as React from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '@customreport/ui/lib/utils';

/**
 * Minimal chart wrapper around recharts — Tailwind-friendly height/width
 * defaults and a styled Tooltip. shadcn-ui Chart's full API was not needed
 * for Phase 30; this slimmer wrapper exposes the two primitives consumed
 * by the trends page chart components.
 */

export function ChartContainer({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  readonly children: React.ReactElement;
}) {
  return (
    <div className={cn('h-64 w-full', className)} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartTooltip(
  props: React.ComponentProps<typeof Tooltip>,
) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        borderRadius: 6,
        fontSize: 12,
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    />
  );
}
