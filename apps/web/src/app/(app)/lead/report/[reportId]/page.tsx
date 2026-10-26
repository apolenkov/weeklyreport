import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  LeadForm,
  LeadFormSkeleton,
} from "../../../../../features/report-pages";
import { LEAD_REPORT_ROUTE } from "../../../../../shared/ui/navigation/nav-links";

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{
    mode?: string | string[];
    feedback?: string | string[];
    feedbackUrl?: string | string[];
    agentationSession?: string | string[];
    agentationAnnotation?: string | string[];
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
    if (typeof value === "string" && value) preserved.set(key, value);
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
  const resolvedMode = mode === "slides" ? mode : "overview";

  if (typeof mode === "string" && mode && resolvedMode !== mode) {
    const preserved = preservedSearchParams(query);
    const suffix = preserved.size > 0 ? `?${preserved.toString()}` : "";
    redirect(`${LEAD_REPORT_ROUTE}/${encodeURIComponent(reportId)}${suffix}`);
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`${resolvedMode === "overview" ? "lead-overview-route" : "min-h-screen"} ${LEAD_FORM_PAGE_BG}`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${resolvedMode === "overview" ? "lead-overview-route-frame" : "py-6"}`}
      >
        <Suspense fallback={<LeadFormSkeleton mode={resolvedMode} />}>
          <LeadForm reportId={reportId} mode={resolvedMode} />
        </Suspense>
      </div>
    </main>
  );
}
