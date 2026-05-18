import { Suspense } from "react";

import { HeadSlidesClient } from "../../../../components/slides/head-slides-client";
import { SlideSkeleton } from "../../../../components/slides/slide-skeleton";

// TODO(HEAD-CONSOLIDATE-01): consider redirecting /head/slides → /head/history?mode=slides
// or /head/report?mode=slides in a future phase once UX consolidation is confirmed.
export default async function HeadSlidesPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<SlideSkeleton />}>
          <HeadSlidesClient />
        </Suspense>
      </div>
    </main>
  );
}
