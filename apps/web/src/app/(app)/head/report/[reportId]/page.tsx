import { Suspense } from "react";
import { HeadReportShell } from "../../../../../components/head/head-report-shell";
import { WeeklyReportSkeleton } from "../../../../../components/weekly-report/weekly-report-skeleton";

type Props = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string; mode?: string }>;
};

/**
 * Phase 35-07 (UX-15): addressed head report.
 * Phase 61 (robust-baking-aurora): adds inline form ↔ slides mode toggle via
 * HeadReportShell. `?mode=slides` shows the head slide deck; default is form.
 */
export default async function HeadReportByIdPage({
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <HeadReportShell
            reportId={reportId}
            mode={mode}
            authorId={authorId}
          />
        </Suspense>
      </div>
    </main>
  );
}
