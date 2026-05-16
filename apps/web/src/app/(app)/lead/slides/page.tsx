import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LeadSlidesClient } from "../../../../components/slides/lead-slides-client";
import { SlideSkeleton } from "../../../../components/slides/slide-skeleton";

type Props = {
  searchParams: Promise<{ reportId?: string }>;
};

export default async function LeadSlidesPage({ searchParams }: Props) {
  const { reportId } = await searchParams;

  if (reportId) {
    redirect("/lead/report/" + encodeURIComponent(reportId) + "?mode=slides");
  }
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<SlideSkeleton />}>
          <LeadSlidesClient />
        </Suspense>
      </div>
    </main>
  );
}
