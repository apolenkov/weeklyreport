import { Suspense } from "react";

import { LeadForm, LeadFormSkeleton } from "../../../../features/report-pages";

interface Props {
  searchParams: Promise<{ mode?: string }>;
}

// Clears the fixed lead-form action bar so content is not covered on scroll.
const LEAD_FORM_ACTION_BAR_CLEARANCE = "88px";

// Back-compat bare route: form client-replaces to the addressed URL once known.
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
        style={{ paddingBottom: LEAD_FORM_ACTION_BAR_CLEARANCE }}
      >
        <Suspense fallback={<LeadFormSkeleton />}>
          <LeadForm redirectToCanonical mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
