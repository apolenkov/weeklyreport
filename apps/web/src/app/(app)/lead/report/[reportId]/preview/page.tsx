import Link from "next/link";

import { LeadSectionPreviewAuth } from "../../../../../../features/report-pages";
import { AgentReviewComingSoon } from "../../../../../../shared/ui/report-shell/agent-review-coming-soon";
import { RoleGate } from "../../../../../../shared/ui/role-gate";

interface Props {
  params: Promise<{ reportId: string }>;
}

// Lead-only: parent layout admits head/admin too; preview is own-authorId only.
export default async function LeadReportPreviewPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <RoleGate allowedRoles={["lead"]}>
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
                Your section as it appears in the head&apos;s consolidated
                report.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AgentReviewComingSoon compact />
              <Link
                href={`/lead/report/${encodeURIComponent(reportId)}`}
                className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                ← Back to form
              </Link>
            </div>
          </header>

          <LeadSectionPreviewAuth reportId={reportId} />
        </div>
      </main>
    </RoleGate>
  );
}
