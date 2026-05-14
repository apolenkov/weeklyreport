import { Suspense } from "react";
import Link from "next/link";

import { WeeklyReportSkeleton } from "../../../../../../components/weekly-report/weekly-report-skeleton";
import { LeadSectionPreviewAuth } from "../../../../../../components/lead/lead-section-preview-auth";

type Props = {
  params: Promise<{ reportId: string }>;
};

/**
 * UFB-NEW-A34 (Phase 60 early activation): lead self-preview surface.
 *
 * Renders the lead's own section exactly as the head sees it in the
 * assembled weekly report. Uses WeeklyReportPage with the current
 * user's authorId so only their products are shown — read-only, no form.
 *
 * Server shell; auth is resolved client-side in LeadSectionPreviewAuth
 * (avoids an extra server-side session fetch and keeps the RSC boundary clean).
 */
export default async function LeadReportPreviewPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Section Preview
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Your section as it appears in the head&apos;s consolidated report.
            </p>
          </div>
          <Link
            href={`/lead/report/${reportId}`}
            className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            ← Back to form
          </Link>
        </header>

        <Suspense fallback={<WeeklyReportSkeleton />}>
          <LeadSectionPreviewAuth reportId={reportId} />
        </Suspense>
      </div>
    </main>
  );
}
