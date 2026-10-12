"use client";

import { Skeleton } from "@customreport/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect } from "react";

import { useQueryErrorHandler } from "../../../../shared/hooks/query/use-query-error-handler";
import { getScalarSearchParam } from "../../../../shared/lib/navigation/scalar-search-param";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { REPORTS_ROUTE } from "../../../../shared/ui/navigation/nav-links";

// Resolve the viewer-specific destination through the existing browser tRPC
// query, then preserve the recovery marker while replacing this entry route.
function ReportsLatestShell({ children }: { readonly children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function ResolvingStatus() {
  return (
    <div
      className="space-y-4 py-4"
      role="status"
      aria-live="polite"
      aria-label="Opening the status report"
    >
      <span className="sr-only">Opening the status report…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function ReportsLatestContent() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recovery =
    getScalarSearchParam(searchParams, "recovery") === "1" ? "1" : "0";

  const latestQ = useQuery(trpc.reports.latestForViewer.queryOptions());
  useQueryErrorHandler(latestQ, {
    event: "reports.latest_for_viewer.load_failed",
    component: "ReportsLatestContent",
    procedure: "reports.latestForViewer",
  });

  const reportId = latestQ.data?.reportId ?? null;

  useEffect(() => {
    if (reportId) {
      router.replace(
        `${REPORTS_ROUTE}/${reportId}?source=status&recovery=${recovery}`,
        {
          scroll: false,
        },
      );
    }
  }, [reportId, router, recovery]);

  const isResolving = latestQ.isLoading || reportId !== null;

  return (
    <ReportsLatestShell>
      {isResolving ? (
        <ResolvingStatus />
      ) : latestQ.isError ? (
        <section
          role="alert"
          aria-labelledby="reports-latest-error-title"
          className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center"
        >
          <h1
            id="reports-latest-error-title"
            className="text-base font-semibold text-[var(--color-foreground)]"
          >
            Status report unavailable
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Could not load the status report.
          </p>
          <button
            type="button"
            onClick={() => {
              void latestQ.refetch().catch(() => undefined);
            }}
            className="btn-press mt-4 inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
          >
            Try again
          </button>
        </section>
      ) : (
        <section
          aria-labelledby="reports-latest-empty-title"
          className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center"
        >
          <h1
            id="reports-latest-empty-title"
            className="text-base font-semibold text-[var(--color-foreground)]"
          >
            No status report yet
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            There is no report to show yet.
          </p>
        </section>
      )}
    </ReportsLatestShell>
  );
}

export default function ReportsLatestPage() {
  return (
    <Suspense
      fallback={
        <ReportsLatestShell>
          <ResolvingStatus />
        </ReportsLatestShell>
      }
    >
      <ReportsLatestContent />
    </Suspense>
  );
}
