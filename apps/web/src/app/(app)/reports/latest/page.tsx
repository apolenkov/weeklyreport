"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useTRPC } from "../../../../lib/trpc-context";

/**
 * `/reports/latest` resolves the **Status target** — the current editable
 * period (when viewer-visible), else the newest
 * viewer-visible published report (`reports.latestForViewer`) — and navigates
 * there, or renders the empty state when none qualifies.
 *
 * Why a client redirect instead of a server `redirect()` (307): the web app has
 * no server-side data path — every authenticated read goes through the browser
 * tRPC client over cookies (`lib/trpc.ts`). `router.replace` re-resolves on
 * every visit (never caches a permanent target) and, being `replace` not
 * `push`, the resolved report's Back returns past `/reports/latest`.
 *
 * Race recovery: the read gate is published-or-current and fail-closed, so an
 * `open → published` flip mid-view yields a `NOT_FOUND` the query client never
 * retries. The report route recovers ONCE by redirecting back here with
 * `?recovery=1`. This page reads that incoming flag and PROPAGATES it onto the
 * resolved URL (`?source=status&recovery=<value>`) — it does not hard-code `0`
 * — so the report route can tell a Status navigation from a History/direct one
 * AND whether it has already retried (loop guard).
 */
export default function ReportsLatestPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recovery = searchParams.get("recovery") === "1" ? "1" : "0";

  const latestQ = useQuery(trpc.reports.latestForViewer.queryOptions());

  const reportId = latestQ.data?.reportId ?? null;

  useEffect(() => {
    if (reportId) {
      router.replace(`/reports/${reportId}?source=status&recovery=${recovery}`);
    }
  }, [reportId, router, recovery]);

  const isResolving = latestQ.isLoading || reportId !== null;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {isResolving ? (
          <p
            className="py-16 text-center text-sm text-[var(--color-muted-foreground)]"
            role="status"
          >
            Opening the status report…
          </p>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {latestQ.isError
                ? "Could not load the status report. Please try again."
                : "There is no report to show yet."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
