import { Suspense } from "react";

import { WeeklyReportSkeleton } from "../../../../features/report-pages";
import { ViewerReportShell } from "../../../../features/viewer";

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{
    authorId?: string | string[];
    mode?: string | string[];
  }>;
}

// Read-only ViewerReportShell; mutation affordances stay off the viewer.
export default async function PublishedReportPage({
  params,
  searchParams,
}: Props) {
  const { reportId } = await params;
  const { authorId, mode: modeParam } = await searchParams;
  const mode = modeParam === "slides" ? "slides" : "form";
  const resolvedAuthorId = typeof authorId === "string" ? authorId : undefined;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <Suspense
          fallback={<WeeklyReportSkeleton mode={mode} audience="viewer" />}
        >
          <ViewerReportShell
            reportId={reportId}
            mode={mode}
            authorId={resolvedAuthorId}
          />
        </Suspense>
      </div>
    </main>
  );
}
