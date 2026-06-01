import { Suspense } from "react";

import { LeadForm } from "../../../../components/lead/lead-form";
import { LeadFormSkeleton } from "../../../../components/lead/lead-form-skeleton";

interface Props {
  searchParams: Promise<{ period?: string; mode?: string }>;
}

/**
 * Bare `/lead/report` route. Phase 35-07 introduces the addressed form
 * `/lead/report/[reportId]` (UX-15). This page is preserved for back-compat:
 * legacy bookmarks / email links still land here, and the form will redirect
 * (client-side `router.replace`) to the canonical URL once the active
 * reportId is known. The redirect is suppressed when `?period=...` is
 * present so old read-only links keep working unchanged.
 *
 * If the user has no active report (server returns null), the form
 * surfaces its existing empty / skeleton state — no hard redirect.
 */
export default async function LeadReportPage({ searchParams }: Props) {
  const { period, mode } = await searchParams;
  const resolvedMode = mode === "slides" ? "slides" : "edit";

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
        style={{ paddingBottom: "88px" }}
      >
        <Suspense fallback={<LeadFormSkeleton />}>
          <LeadForm period={period} redirectToCanonical mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
