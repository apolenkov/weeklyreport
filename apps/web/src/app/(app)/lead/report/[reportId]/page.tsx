import { Suspense } from "react";

import { LeadForm } from "../../../../../components/lead/lead-form";
import { LeadFormSkeleton } from "../../../../../components/lead/lead-form-skeleton";

type Props = {
  params: Promise<{ reportId: string }>;
};

/**
 * Phase 35-07 (UX-15): addressed lead form. The `[reportId]` segment pins
 * the form to a specific report so every period the lead has access to
 * has a shareable / bookmarkable URL. The bare `/lead/report` route
 * redirects to the canonical addressed URL once the active reportId is
 * known.
 *
 * The form itself enforces read-only behaviour for non-active reports
 * (the server returns `readOnly: true` from `leadForm.byPeriod` when the
 * pinned report doesn't match the lead's active section).
 */
export default async function LeadReportByIdPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[linear-gradient(180deg,rgba(0,98,65,0.04)_0%,var(--color-background)_160px)]"
    >
      <div
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
        style={{ paddingBottom: "88px" }}
      >
        <Suspense fallback={<LeadFormSkeleton />}>
          <LeadForm reportId={reportId} />
        </Suspense>
      </div>
    </main>
  );
}
