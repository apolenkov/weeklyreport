import { Suspense } from "react";

import { LeadForm } from "../../../../features/report-pages/ui/lead-form";
import { LeadFormSkeleton } from "../../../../features/report-pages/ui/lead-form-skeleton";

interface Props {
  searchParams: Promise<{ mode?: string }>;
}

/**
 * Bare `/lead/report` route. The addressed form `/lead/report/[reportId]`
 * is canonical. This page is preserved for back-compat:
 * legacy bookmarks / email links still land here, and the form redirects
 * (client-side `router.replace`) to the canonical URL once the active
 * reportId is known. The legacy `?period=<week>` query is no longer a
 * special case — viewing a past week goes through the addressed URL plus
 * the history dropdown — so it is ignored and the redirect still fires.
 *
 * If the user has no active report (server returns null), the form
 * surfaces its existing empty / skeleton state — no hard redirect.
 */
export default async function LeadReportPage({ searchParams }: Props) {
  const { mode } = await searchParams;
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
          <LeadForm redirectToCanonical mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
