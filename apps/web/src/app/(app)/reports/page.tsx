"use client";

import {
  HistoryPanel,
  historySubtitle,
  HistoryToolbar,
  useHistoryData,
} from "../../../features/period";
import { useSession } from "../../../shared/lib/auth/session-provider";

// One role-defaulted history view: leads get personal History, everyone else
// compiled. No tab state and no `tab` query parameter; Archive is local, non-URL
// state so the address bar stays stable when the switch is flipped.
export default function ReportsPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const role = user?.role ?? null;

  const {
    entries,
    archiveCount,
    isLoading,
    failure,
    includeArchive,
    setIncludeArchive,
    isLead,
  } = useHistoryData(role);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              History
            </h1>
            <p className="mt-1 min-h-5 text-sm text-[var(--color-muted-foreground)]">
              {isSessionLoading ? null : historySubtitle(role)}
            </p>
          </header>

          <HistoryToolbar
            role={role}
            includeArchive={includeArchive}
            archiveCount={archiveCount}
            onArchiveChange={setIncludeArchive}
          />

          <HistoryPanel
            entries={entries}
            includeArchive={includeArchive}
            isLoading={isSessionLoading || isLoading}
            failure={failure}
            summaryTitle={
              isLead ? "My History Summary" : "Portfolio History Summary"
            }
            isLead={isLead}
          />
        </div>
      </div>
    </main>
  );
}
