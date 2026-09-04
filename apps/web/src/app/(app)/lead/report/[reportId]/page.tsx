import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  LeadForm,
  LeadFormSkeleton,
} from "../../../../../features/report-pages";

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{
    mode?: string;
    feedback?: string;
    feedbackUrl?: string;
    agentationSession?: string;
    agentationAnnotation?: string;
  }>;
}

const PRESERVED_QUERY_KEYS = [
  "feedback",
  "feedbackUrl",
  "agentationSession",
  "agentationAnnotation",
] as const;

function preservedSearchParams(
  query: Awaited<Props["searchParams"]>,
): URLSearchParams {
  const preserved = new URLSearchParams();
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = query[key];
    if (value) preserved.set(key, value);
  }
  return preserved;
}

// Soft brand wash under the form chrome; fades into page background by 160px.
const LEAD_FORM_PAGE_BG =
  "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-starbucks-green)_4%,transparent)_0%,var(--color-background)_160px)]";

export default async function LeadReportByIdPage({
  params,
  searchParams,
}: Props) {
  const { reportId } = await params;
  const query = await searchParams;
  const { mode } = query;
  const resolvedMode = mode === "slides" || mode === "edit" ? mode : "overview";

  if (mode && resolvedMode !== mode) {
    const preserved = preservedSearchParams(query);
    const suffix = preserved.size > 0 ? `?${preserved.toString()}` : "";
    redirect(`/lead/report/${encodeURIComponent(reportId)}${suffix}`);
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`min-h-screen ${LEAD_FORM_PAGE_BG}`}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<LeadFormSkeleton mode={resolvedMode} />}>
          <LeadForm reportId={reportId} mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
