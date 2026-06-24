"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useTRPC } from "../../../../lib/trpc-context";

/**
 * viewer-report-surface-parity (task 3.1): `/reports/latest` resolves the most
 * recent report the caller can OPEN (server gate: `periodStatus = 'published'`
 * + a group-visible section, `reports.latestPublished`) and navigates there,
 * or renders the empty state when none qualifies.
 *
 * Why a client redirect instead of a server `redirect()` (307): the web app has
 * no server-side data path — every authenticated read goes through the browser
 * tRPC client over cookies (`lib/trpc.ts`), and nothing in the app reads the
 * session via `next/headers`. The task's "307, not 308" requirement encodes one
 * property — re-resolve on every visit, never cache a permanent target — which
 * `router.replace` satisfies just as well. `replace` (not `push`) also avoids a
 * Back-button loop: the resolved report's Back returns past `/reports/latest`,
 * not into another redirect.
 */
export default function ReportsLatestPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const latestQ = useQuery(trpc.reports.latestPublished.queryOptions());

  const reportId = latestQ.data?.reportId ?? null;

  useEffect(() => {
    if (reportId) {
      router.replace(`/reports/${reportId}`);
    }
  }, [reportId, router]);

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
            Opening the latest report…
          </p>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {latestQ.isError
                ? "Could not load the latest report. Please try again."
                : "No published report is available to you yet."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
