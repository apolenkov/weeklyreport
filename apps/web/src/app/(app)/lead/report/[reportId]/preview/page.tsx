import Link from "next/link";
import { Suspense } from "react";

import { LeadSectionPreviewAuth } from "../../../../../../components/lead/lead-section-preview-auth";
import { AgentReviewComingSoon } from "../../../../../../components/report-shell/agent-review-coming-soon";
import { RoleGate } from "../../../../../../components/role-gate";
import { WeeklyReportSkeleton } from "../../../../../../components/weekly-report/weekly-report-skeleton";

interface Props {
  params: Promise<{ reportId: string }>;
}

/**
 * UFB-NEW-A34 (Phase 60 early activation): lead self-preview surface.
 *
 * Renders the lead's section exactly as the head sees it in the assembled
 * weekly report. Uses WeeklyReportPage with the current user's authorId to
 * open / highlight / scroll their own section. The product list is scoped to
 * the lead's reporting group server-side (weeklyReport.get via the GroupProduct
 * join), not to the products the lead personally authors
 * (driver-findings-2026-06-11 finding 2). Read-only, no form.
 *
 * Server shell. The preview is a lead-only self-review surface: the parent
 * `/lead/*` layout admits lead/head/admin, so this page adds a per-page guard
 * that walls non-lead roles (head/admin) — the preview is scoped to the
 * viewer's own authorId and is meaningless for them. Denial uses the same
 * in-page `ForbiddenPage` wall as every other role gate.
 */
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
                href={`/lead/report/${reportId}`}
                className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                ← Back to form
              </Link>
            </div>
          </header>

          <Suspense fallback={<WeeklyReportSkeleton />}>
            <LeadSectionPreviewAuth reportId={reportId} />
          </Suspense>
        </div>
      </main>
    </RoleGate>
  );
}
