import { Suspense } from "react";

import { WeeklyReportSkeleton } from "../../../../features/report-pages/ui/weekly-report-skeleton";
import { ViewerReportShell } from "../../../../features/viewer/ui/viewer-report-shell";

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string; mode?: string }>;
}

/**
 * Published Report Viewer.
 *
 * viewer-report-surface-parity (task 5): the page now renders the read-only
 * `ViewerReportShell` (the analogue of `HeadReportShell`) instead of mounting
 * `WeeklyReportPage` directly. The shell adds toolbar parity — ScopeToggle,
 * ViewModeToggle, period navigation, Export-PDF — and resolves `?mode=slides`
 * into real slides, fixing the previously inert viewer `/present` deep link.
 * All mutation affordances stay off the viewer (no HeadPublishLockAction; the
 * page gates Publish/Reopen/Move-to-archive on head/admin only).
 */
export default async function PublishedReportPage({
  params,
  searchParams,
}: Props) {
  const { reportId } = await params;
  const { authorId, mode: modeParam } = await searchParams;
  const mode = modeParam === "slides" ? "slides" : "form";

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <ViewerReportShell
            reportId={reportId}
            mode={mode}
            authorId={authorId}
          />
        </Suspense>
      </div>
    </main>
  );
}
