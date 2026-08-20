"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect } from "react";

import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";

// A client redirect rather than a server `redirect()`: the web app has no
// server-side data path — every authenticated read goes through the browser
// tRPC client over cookies (`lib/trpc.ts`).
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
    <p
      className="py-16 text-center text-sm text-[var(--color-muted-foreground)]"
      role="status"
    >
      Opening the status report…
    </p>
  );
}

function ReportsLatestContent() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recovery = searchParams.get("recovery") === "1" ? "1" : "0";

  const latestQ = useQuery(trpc.reports.latestForViewer.queryOptions());

  const reportId = latestQ.data?.reportId ?? null;

  useEffect(() => {
    if (reportId) {
      router.replace(
        `/reports/${reportId}?source=status&recovery=${recovery}`,
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
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
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
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            There is no report to show yet.
          </p>
        </div>
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
