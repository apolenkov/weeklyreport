"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useTRPC } from "../../../../lib/trpc-context";

// A client redirect rather than a server `redirect()`: the web app has no
// server-side data path — every authenticated read goes through the browser
// tRPC client over cookies (`lib/trpc.ts`).
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
