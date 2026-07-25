"use client";

import { isLead as isLeadRole } from "../../../lib/role-predicates";
import { useSession } from "../../../lib/session-provider";
import { HistoryPanel } from "./history-panel";
import { historySubtitle } from "./history-role-view";
import { HistoryToolbar } from "./history-toolbar";
import { useHistoryData } from "./use-history-data";

// One role-defaulted history view: leads get personal History, everyone else
// compiled. No tab state and no `tab` query parameter; Archive is local, non-URL
// state so the address bar stays stable when the switch is flipped.
export default function ReportsPage() {
  const { user } = useSession();
  const role = user?.role ?? null;
  const isLead = isLeadRole(role);

  const {
    entries,
    archiveCount,
    isLoading,
    includeArchive,
    setIncludeArchive,
  } = useHistoryData(role);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              History
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {historySubtitle(role)}
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
            isLoading={isLoading}
            summaryTitle={isLead ? "My History Summary" : "History Summary"}
            isLead={isLead}
          />
        </div>
      </div>
    </main>
  );
}
