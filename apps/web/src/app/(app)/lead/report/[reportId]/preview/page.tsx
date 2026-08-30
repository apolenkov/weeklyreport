import Link from "next/link";

import { LeadSectionPreviewAuth } from "../../../../../../features/report-pages";
import { LEAD_PREVIEW_ROUTE_ROLES } from "../../../../../../shared/model/route-role-policy";
import { RoleGate } from "../../../../../../shared/ui/auth-runtime/role-gate";

interface Props {
  params: Promise<{ reportId: string }>;
}

// Lead-only: parent layout admits head/admin too; preview is own-authorId only.
export default async function LeadReportPreviewPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <RoleGate allowedRoles={LEAD_PREVIEW_ROUTE_ROLES}>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-[var(--color-background)]"
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
              <Link
                href={`/lead/report/${encodeURIComponent(reportId)}`}
                className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
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
