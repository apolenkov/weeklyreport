"use client";

// Phase 54 (UFB-055): Period-level AI summary surface — seeds-only.
//
// Renders a shadcn <Tabs> block alongside the existing AiSummaryCard on
// the report page. One tab shows the assembled report (default,
// rendered by the parent), the other shows the mock period summary
// labelled with a clear «(заглушка)» badge so consumers never confuse
// it with the real Phase 31 executive summary.
//
// The tRPC procedure `ai.periodSummary` is leadership-only
// (head + admin + viewer) — leads visiting `/reports/<id>` will get a
// FORBIDDEN which we render as an empty state.

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@customreport/ui/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";

import { useTRPC } from "../../lib/trpc-context";

type Props = {
  readonly periodId: string;
};

/**
 * The "AI Summary" tab body. Reads `ai.periodSummary` and renders the
 * mock prose with a clear seeds-only badge.
 */
function AiSummaryTabContent({ periodId }: Props) {
  const trpc = useTRPC();
  const summaryQ = useQuery(trpc.ai.periodSummary.queryOptions({ periodId }));

  if (summaryQ.isLoading) {
    return (
      <div
        className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4 text-sm text-[var(--color-muted-foreground)]"
        aria-busy="true"
      >
        Загружаем AI summary…
      </div>
    );
  }

  if (summaryQ.isError || !summaryQ.data) {
    return (
      <div
        className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4 text-sm text-[var(--color-muted-foreground)]"
        role="status"
      >
        AI summary недоступен.
      </div>
    );
  }

  const { summary, source, citationIds } = summaryQ.data;
  const isMock = source === "mock";

  if (!summary) {
    return (
      <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4 text-sm text-[var(--color-muted-foreground)]">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--color-foreground)]">
            AI Summary
          </h3>
          {isMock ? (
            <Badge variant="secondary" aria-label="Mock summary stub">
              (заглушка)
            </Badge>
          ) : null}
        </div>
        Нет опубликованных секций для саммари.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4 text-sm text-[var(--color-foreground)]">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--color-foreground)]">
          AI Summary
        </h3>
        {isMock ? (
          <Badge variant="secondary" aria-label="Mock summary stub">
            (заглушка)
          </Badge>
        ) : null}
      </div>
      <p
        className="whitespace-pre-line text-sm leading-relaxed"
        data-testid="ai-summary-text"
      >
        {summary}
      </p>
      {citationIds.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          Цитаты по {citationIds.length}{" "}
          {citationIds.length === 1 ? "секции" : "секциям"}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Public surface — Tabs wrapper. Default tab is "Report" (rendered by
 * the parent through the `children` prop); switching to "AI Summary"
 * lazily fires the tRPC query. Keeping the Report tab as a passthrough
 * keeps this component decoupled from WeeklyReportPage internals.
 */
export function PeriodSummaryTabs({
  periodId,
  children,
}: Props & { readonly children: React.ReactNode }) {
  return (
    <Tabs defaultValue="report" className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="report">Report</TabsTrigger>
        <TabsTrigger value="ai-summary">AI Summary</TabsTrigger>
      </TabsList>
      <TabsContent value="report">{children}</TabsContent>
      <TabsContent value="ai-summary">
        <AiSummaryTabContent periodId={periodId} />
      </TabsContent>
    </Tabs>
  );
}
