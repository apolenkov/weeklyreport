"use client";

import type { LeadVelocityOutput } from "@customreport/shared";

import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

/**
 * ANAL-04 (Phase 30-03): stacked-bar of submitted-section counts per lead per period.
 */

const COLORS = [
  "#15803d",
  "#2563eb",
  "#9333ea",
  "#0891b2",
  "#c2410c",
  "#a21caf",
];

export function LeadVelocityChart({
  rows,
}: {
  readonly rows: LeadVelocityOutput;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No velocity data in range.
      </p>
    );
  }

  const leadIds = Array.from(
    new Set(rows.flatMap((r) => r.leads.map((l) => l.leadId))),
  );
  const leadNameById = new Map<string, string>();
  for (const r of rows) {
    for (const l of r.leads) {
      if (!leadNameById.has(l.leadId)) leadNameById.set(l.leadId, l.leadName);
    }
  }

  const data = rows.map((r) => {
    const point: Record<string, number | string> = { period: r.periodLabel };
    for (const id of leadIds) {
      const found = r.leads.find((l) => l.leadId === id);
      point[leadNameById.get(id) ?? id] = found?.submittedSections ?? 0;
    }
    return point;
  });

  return (
    <ChartContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis allowDecimals={false} />
        <ChartTooltip />
        <Legend />
        {leadIds.map((id, idx) => (
          <Bar
            key={id}
            dataKey={leadNameById.get(id) ?? id}
            stackId="leads"
            fill={COLORS[idx % COLORS.length]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
