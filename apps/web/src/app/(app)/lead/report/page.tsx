import { Suspense } from "react";

import { LeadForm, LeadFormSkeleton } from "../../../../features/report-pages";

interface Props {
  searchParams: Promise<{ mode?: string | string[] }>;
}

// Addressable entry route: the form replaces it with the active report URL
// once the current period is known.
export default async function LeadReportPage({ searchParams }: Props) {
  const { mode } = await searchParams;
  const resolvedMode = mode === "slides" ? mode : "overview";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<LeadFormSkeleton mode={resolvedMode} />}>
          <LeadForm redirectToCanonical mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
