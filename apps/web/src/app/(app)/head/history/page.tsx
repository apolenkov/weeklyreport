import { Suspense } from "react";

import { WeeklyReportSkeleton } from "../../../../components/weekly-report/weekly-report-skeleton";
import { HeadHistoryClient } from "../../../../components/head/head-history-client";

/**
 * Phase 61 (robust-baking-aurora): head history page — period navigator with
 * inline form ↔ slides mode toggle. Mirrors /lead/report/[id] UX for the head
 * role. Reads published periods via compiledHistory; no new DB tables.
 */
export default async function HeadHistoryPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <HeadHistoryClient />
        </Suspense>
      </div>
    </main>
  );
}
